import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class OrderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']
        self.group_name = f'order_{self.order_id}'
        self.user = self.scope.get('user')
        self.locked_rows = set()

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(self.group_name, {
            'type': 'broadcast',
            'payload': {
                'event': 'user:joined',
                'user_id': self.user.id,
                'user_name': self.user.full_name or self.user.username,
            }
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            # Release all rows this connection had locked so other clients see them unlocked immediately
            for row_id in list(self.locked_rows):
                await self.channel_layer.group_send(self.group_name, {
                    'type': 'broadcast',
                    'payload': {
                        'event': 'row:unlock',
                        'row_id': row_id,
                        'user_id': self.user.id,
                    }
                })
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast',
                'payload': {
                    'event': 'user:left',
                    'user_id': self.user.id,
                    'user_name': self.user.full_name or self.user.username,
                }
            })
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        event = data.get('event')

        if event == 'row:update':
            await self._handle_row_update(data)
        elif event == 'row:lock':
            await self._handle_row_lock(data)
        elif event == 'row:unlock':
            await self._handle_row_unlock(data)
        elif event == 'order:status':
            await self._handle_order_status(data)

    async def _handle_row_update(self, data):
        row_id = data.get('row_id')
        fields = data.get('fields', {})

        result = await self._save_row(row_id, fields)
        if not result:
            return

        await self.channel_layer.group_send(self.group_name, {
            'type': 'broadcast',
            'payload': {
                'event': 'row:updated',
                'row_id': row_id,
                'fields': result['row'],
                'user_id': self.user.id,
                'user_name': self.user.full_name or self.user.username,
            }
        })

        # Auto-transition new → in_progress broadcast
        if result.get('status_changed'):
            await self.channel_layer.group_send(self.group_name, {
                'type': 'broadcast',
                'payload': {
                    'event': 'order:status',
                    'status': result['status_changed'],
                    'auto': True,
                }
            })

    async def _handle_row_lock(self, data):
        row_id = data.get('row_id')
        if row_id is not None:
            self.locked_rows.add(row_id)
        await self.channel_layer.group_send(self.group_name, {
            'type': 'broadcast',
            'payload': {
                'event': 'row:lock',
                'row_id': row_id,
                'user_id': self.user.id,
                'user_name': self.user.full_name or self.user.username,
            }
        })

    async def _handle_row_unlock(self, data):
        row_id = data.get('row_id')
        if row_id is not None:
            self.locked_rows.discard(row_id)
        await self.channel_layer.group_send(self.group_name, {
            'type': 'broadcast',
            'payload': {
                'event': 'row:unlock',
                'row_id': row_id,
                'user_id': self.user.id,
            }
        })

    async def _handle_order_status(self, data):
        new_status = data.get('status')
        await self._save_order_status(new_status)
        await self.channel_layer.group_send(self.group_name, {
            'type': 'broadcast',
            'payload': {
                'event': 'order:status',
                'status': new_status,
                'user_id': self.user.id,
            }
        })

    @database_sync_to_async
    def _save_row(self, row_id, fields):
        from .models import Order, OrderRow

        allowed = {'item_name', 'fulfillment_status', 'quantity', 'unit', 'price'}
        try:
            row = OrderRow.objects.select_related('order').get(
                pk=row_id,
                order_id=self.order_id,
            )
            for key, val in fields.items():
                if key in allowed:
                    if key in ('quantity', 'price') and val == '':
                        val = None
                    setattr(row, key, val)
            row.updated_by = self.user
            row.save()

            total = None
            if row.quantity is not None and row.price is not None:
                total = float(row.quantity * row.price)

            row_data = {
                'item_name': row.item_name,
                'fulfillment_status': row.fulfillment_status,
                'quantity': str(row.quantity) if row.quantity is not None else None,
                'unit': row.unit,
                'price': str(row.price) if row.price is not None else None,
                'total': f'{total:.2f}' if total is not None else None,
                'updated_at': row.updated_at.isoformat(),
                'row_number': row.row_number,
            }

            # Auto-transition: new → in_progress on first edit of any field
            status_changed = None
            if row.order.status == 'new':
                updated = Order.objects.filter(
                    pk=self.order_id, status='new'
                ).update(status='in_progress')
                if updated:
                    status_changed = 'in_progress'

            return {'row': row_data, 'status_changed': status_changed}
        except OrderRow.DoesNotExist:
            return None

    @database_sync_to_async
    def _save_order_status(self, status):
        from .models import Order
        Order.objects.filter(pk=self.order_id).update(status=status)

    async def broadcast(self, event):
        await self.send(text_data=json.dumps(event['payload']))
