"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from accounts.views import LoginAPI, SignupAPI, protected_view, LogoutAPI, contact_list, contact_detail, transaction_list, transaction_detail, balance_view,profile_balance_view, settle_split_view, unsettle_split_view, individual_transaction_list, settle_individual_transaction_view, unsettle_individual_transaction_view
from rest_framework_simplejwt.views import TokenRefreshView
# from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    # path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/', LoginAPI.as_view()),
    path('signup/', SignupAPI.as_view()),
    path('protected/', protected_view),
    path('refresh/', TokenRefreshView.as_view()),
    path('logout/', LogoutAPI.as_view()),
    path('contacts/', contact_list),
    path('contacts/<int:pk>/', contact_detail),
    path("transactions/", transaction_list),
    path("transactions/<int:pk>/", transaction_detail),
    path('contacts/<int:pk>/balance/', balance_view),
    path('profile/balance/', profile_balance_view),
    path("transaction-splits/<int:split_id>/settle/", settle_split_view),
    path("transaction-splits/<int:split_id>/unsettle/", unsettle_split_view),
    path("contacts/<int:contact_id>/individual-transactions/",individual_transaction_list,),
    path("individual-transactions/<int:transaction_id>/settle/",settle_individual_transaction_view,),
    path("individual-transactions/<int:transaction_id>/unsettle/",unsettle_individual_transaction_view,),
    ]