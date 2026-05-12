from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Владелец'
        WORKER = 'worker', 'Сотрудник'

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.WORKER)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'accounts_user'
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'

    @property
    def is_owner(self):
        return self.role == self.Role.OWNER or self.is_superuser

    def __str__(self):
        return self.full_name or self.username
