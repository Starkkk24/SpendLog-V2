from django.contrib import admin
from .models import Contact, Transaction, TransactionSplit, IndividualTransaction


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "created_at")
    search_fields = ("name",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "payer_user", "payer_contact", "total_amount", "transaction_datetime")
    list_filter = ("transaction_datetime",)


@admin.register(TransactionSplit)
class TransactionSplitAdmin(admin.ModelAdmin):
    list_display = ("id", "transaction", "contact", "amount")


@admin.register(IndividualTransaction)
class TIndividualTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "direction", "amount", "settled_amount", "note", "transaction_datetime", "created_at")
