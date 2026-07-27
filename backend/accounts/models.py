from django.db import models
from django.contrib.auth.models import User

# Create your models here.

class Contact(models.Model):
    owner = models.ForeignKey(
        User,
        on_delete = models.PROTECT,
        related_name="contacts"
    )
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"],
                name="unique_contact_per_owner"
            )
        ]

    def __str__(self):
        return self.name



class Transaction(models.Model):
    paid_by = models.ForeignKey(
        Contact,
        on_delete = models.PROTECT,
        related_name = "transactions_paid"
    )
    total_amount = models.DecimalField(
            max_digits=10,
            decimal_places=2
    )
    note = models.TextField(blank=True)
    transaction_datetime = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.paid_by.name} - ₹{self.total_amount}"


class TransactionSplit(models.Model):
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.PROTECT,
        related_name="splits"
    )

    contact = models.ForeignKey(
        Contact,
        on_delete=models.PROTECT,
        related_name="transaction_splits"
    )

    signed_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    class Meta:
        constraints = [
          models.UniqueConstraint(
             fields=["transaction", "contact"],
             name="unique_contact_per_transaction"
         )
        ]

    def __str__(self):
        return f"{self.contact.name}: {self.signed_amount}"