
from datetime import date
from pydantic import BaseModel
from typing import List, Literal

class WeeklyRule(BaseModel):
    isActive: bool
    activeDays: List[int]
    modifierType: Literal['percentage', 'fixed']
    modifierValue: float

class SpecialEvent(BaseModel):
    id: str
    name: str
    startDate: str
    endDate: str
    modifierType: Literal['percentage', 'fixed']
    modifierValue: float

class RateRulesConfig(BaseModel):
    weeklyRules: WeeklyRule
    specialEvents: List[SpecialEvent]

def calculate_yield_price(base_price: float, date_obj, rules) -> float:
    if not rules:
        return base_price
        
    date_str = date_obj.strftime('%Y-%m-%d')
    
    if hasattr(rules, 'weekly_rules'): # It's a DB model
        weekly = rules.weekly_rules or {}
        special_events = rules.special_events or []
    elif hasattr(rules, 'weeklyRules'): # It's a Pydantic model
        weekly = rules.weeklyRules
        if hasattr(weekly, 'dict'): weekly = weekly.dict()
        special_events = rules.specialEvents
        if special_events and len(special_events) > 0 and not isinstance(special_events[0], dict):
            special_events = [e.dict() for e in special_events]
    else:
        return base_price

    for event in special_events:
        if event.get('startDate') <= date_str <= event.get('endDate'):
            mod_type = event.get('modifierType')
            mod_val = event.get('modifierValue', 0.0)
            if mod_type == 'percentage':
                return base_price * mod_val
            elif mod_type == 'fixed':
                return base_price + mod_val
                
    if weekly.get('isActive'):
        day_of_week = (date_obj.weekday() + 1) % 7
        active_days = weekly.get('activeDays', [])
        print(f"DEBUG: date={date_str}, day_of_week={day_of_week}, active_days={active_days}")
        if day_of_week in active_days:
            mod_type = weekly.get('modifierType')
            mod_val = weekly.get('modifierValue', 0.0)
            if mod_type == 'percentage':
                return base_price * mod_val
            elif mod_type == 'fixed':
                return base_price + mod_val
                
    return base_price

# Test
rules = RateRulesConfig(
    weeklyRules={'isActive': True, 'activeDays': [5, 6], 'modifierType': 'percentage', 'modifierValue': 1.20},
    specialEvents=[]
)

# Test Feb 27, 2026 (Friday)
d = date(2026, 2, 27)
price = calculate_yield_price(800.0, d, rules)
print(f"Price for {d}: {price}")

# Test Feb 28, 2026 (Saturday)
d = date(2026, 2, 28)
price = calculate_yield_price(800.0, d, rules)
print(f"Price for {d}: {price}")

# Test Mar 1, 2026 (Sunday)
d = date(2026, 3, 1)
price = calculate_yield_price(800.0, d, rules)
print(f"Price for {d}: {price}")
