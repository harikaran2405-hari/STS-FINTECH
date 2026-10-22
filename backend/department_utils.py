VALID_DEPARTMENTS = ['interns', 'ai_ml_frontend', 'backend']

DEPARTMENT_DEFINITIONS = [
    {
        'key': 'interns',
        'label': 'Interns',
        'description': 'Student trainees, intern software engineers and associate interns'
    },
    {
        'key': 'ai_ml_frontend',
        'label': 'AI/ML, Frontend Engineer',
        'description': 'Artificial Intelligence, Machine Learning and Frontend Engineering teams'
    },
    {
        'key': 'backend',
        'label': 'Backend Engineer',
        'description': 'Core backend services, API systems and database architecture'
    }
]

DEPARTMENT_MAP = {
    'interns': 'Interns',
    'ai_ml_frontend': 'AI/ML, Frontend Engineer',
    'backend': 'Backend Engineer'
}

def normalize_department(dept_input: str) -> str:
    """
    Normalizes any user or frontend department string into one of the 3 permitted database keys:
    - 'interns'
    - 'ai_ml_frontend'
    - 'backend'
    Returns canonical key or None if invalid.
    """
    if not dept_input:
        return None
    val = dept_input.strip().lower()
    
    # Direct match
    if val in VALID_DEPARTMENTS:
        return val

    # Match by label or variations
    if 'intern' in val:
        return 'interns'
    elif 'ai' in val or 'frontend' in val or 'ml' in val:
        return 'ai_ml_frontend'
    elif 'back' in val:
        return 'backend'

    return None

def get_department_label(dept_key: str) -> str:
    """Returns official human-readable department label."""
    norm = normalize_department(dept_key)
    return DEPARTMENT_MAP.get(norm, dept_key or 'Unassigned')
