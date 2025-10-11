# Role-based permissions configuration
# Defines what each role can access and do

ROLES = {
    'General Manager': {
        'name_ar': 'مدير عام',
        'name_en': 'General Manager',
        'permissions': {
            'hr': {'read': True, 'write': True, 'delete': True, 'view_salaries': True},
            'financial': {'read': True, 'write': True, 'delete': True},
            'users': {'read': True, 'write': True, 'delete': True},
            'settings': {'read': True, 'write': True}
        }
    },
    'CEO': {
        'name_ar': 'المدير التنفيذي',
        'name_en': 'CEO',
        'permissions': {
            'hr': {'read': True, 'write': True, 'delete': True, 'view_salaries': True},
            'financial': {'read': True, 'write': True, 'delete': True},
            'users': {'read': True, 'write': True, 'delete': True},
            'settings': {'read': True, 'write': True}
        }
    },
    'Board Chairman': {
        'name_ar': 'رئيس مجلس الإدارة',
        'name_en': 'Board Chairman',
        'permissions': {
            'hr': {'read': True, 'write': True, 'delete': True, 'view_salaries': True},
            'financial': {'read': True, 'write': True, 'delete': True},
            'users': {'read': True, 'write': True, 'delete': True},
            'settings': {'read': True, 'write': True}
        }
    },
    'Financial Manager': {
        'name_ar': 'المدير المالي',
        'name_en': 'Financial Manager',
        'permissions': {
            'hr': {'read': True, 'write': True, 'delete': True, 'view_salaries': True},
            'financial': {'read': True, 'write': True, 'delete': True},
            'users': {'read': False, 'write': False, 'delete': False},
            'settings': {'read': True, 'write': False}
        }
    },
    'Chief Accountant': {
        'name_ar': 'رئيس الحسابات',
        'name_en': 'Chief Accountant',
        'permissions': {
            'hr': {'read': True, 'write': False, 'delete': False, 'view_salaries': True},
            'financial': {'read': True, 'write': True, 'delete': True},
            'users': {'read': False, 'write': False, 'delete': False},
            'settings': {'read': True, 'write': False}
        }
    },
    'HR Manager': {
        'name_ar': 'مدير الموارد البشرية',
        'name_en': 'HR Manager',
        'permissions': {
            'hr': {'read': True, 'write': True, 'delete': True, 'view_salaries': False},  # Cannot see salary values
            'financial': {'read': False, 'write': False, 'delete': False},
            'users': {'read': False, 'write': False, 'delete': False},
            'settings': {'read': True, 'write': False}
        }
    },
    'Accountant': {
        'name_ar': 'محاسب',
        'name_en': 'Accountant',
        'permissions': {
            'hr': {'read': False, 'write': False, 'delete': False, 'view_salaries': False},
            'financial': {'read': True, 'write': False, 'delete': False},  # View only
            'users': {'read': False, 'write': False, 'delete': False},
            'settings': {'read': False, 'write': False}
        }
    }
}

def get_role_permissions(role: str):
    """Get permissions for a specific role"""
    return ROLES.get(role, {}).get('permissions', {})

def can_access_module(role: str, module: str, action: str = 'read'):
    """Check if a role can access a specific module"""
    permissions = get_role_permissions(role)
    module_perms = permissions.get(module, {})
    return module_perms.get(action, False)

def can_view_salaries(role: str):
    """Check if a role can view salary amounts"""
    permissions = get_role_permissions(role)
    hr_perms = permissions.get('hr', {})
    return hr_perms.get('view_salaries', False)

def get_all_roles(language='en'):
    """Get list of all available roles"""
    name_key = 'name_ar' if language == 'ar' else 'name_en'
    return [{'key': key, 'name': value[name_key]} for key, value in ROLES.items()]
