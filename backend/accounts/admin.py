from django.contrib import admin
from .models import Contact, Transaction, TransactionSplit


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "created_at")
    search_fields = ("name",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "paid_by", "total_amount", "transaction_datetime")
    list_filter = ("transaction_datetime",)


@admin.register(TransactionSplit)
class TransactionSplitAdmin(admin.ModelAdmin):
    list_display = ("id", "transaction", "contact", "signed_amount")