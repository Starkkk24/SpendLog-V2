from rest_framework import serializers
from .models import Contact, Transaction, TransactionSplit


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = "__all__"
        read_only_fields = ["owner"]


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = "__all__"


class TransactionSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionSplit
        fields = "__all__"