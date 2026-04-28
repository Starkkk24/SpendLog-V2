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
from accounts.views import LoginAPI, SignupAPI, protected_view, LogoutAPI
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
]