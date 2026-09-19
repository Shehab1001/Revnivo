from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class PlatformSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    website = serializers.URLField(required=False, allow_blank=True)
    default_currency = serializers.CharField(max_length=8, default="USD")
    logo = serializers.ImageField(required=False, allow_null=True)

    def validate_default_currency(self, value):
        return value.strip().upper()


class EarningSerializer(serializers.Serializer):
    platform_id = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0.01)
    currency = serializers.CharField(max_length=8)
    earned_at = serializers.DateField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    category = serializers.CharField(required=False, allow_blank=True, max_length=80)

    def validate_currency(self, value):
        return value.strip().upper()
