from django.db import models
from django.contrib.auth.models import User

# Create your models here.

class Contact(models.Model):
    owner = models.ForeignKey(
        User,
        on_delete = models.PROTECT,
        related_name="contacts" #what is related_name ?
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
    payer_user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transactions_paid_as_user"
    )

    payer_contact = models.ForeignKey(
        Contact,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transactions_paid_as_contact"
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    note = models.TextField(blank=True)

    transaction_datetime = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        payer = self.payer_user or self.payer_contact
        return f"{payer} - ₹{self.total_amount}"


class TransactionSplit(models.Model):
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name="splits"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transaction_splits_as_user"
    )

    contact = models.ForeignKey(
        Contact,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transaction_splits_as_contact"
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    settled_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["transaction", "user"],
                name="unique_user_per_transaction"
            ),
            models.UniqueConstraint(
                fields=["transaction", "contact"],
                name="unique_contact_per_transaction"
            ),
        ]

    def __str__(self):
        participant = self.user or self.contact
        return f"{participant}: ₹{self.amount}"

class IndividualTransaction(models.Model):
    DIRECTION_CHOICES = [
        ("lend", "Lend"),
        ("borrow", "Borrow"),
    ]

    contact = models.ForeignKey(
        Contact,
        on_delete=models.PROTECT,
        related_name="individual_transactions"
    )

    direction = models.CharField(
        max_length=10,
        choices=DIRECTION_CHOICES
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    settled_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    note = models.TextField(blank=True)

    transaction_datetime = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)