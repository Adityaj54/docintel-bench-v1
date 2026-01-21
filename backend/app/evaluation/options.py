from pydantic import Field

from app.schemas.common import InputModel


class EvaluationOptions(InputModel):
    normalize_strings: bool = True
    case_sensitive: bool = False
    numeric_tolerance: float = Field(default=0.01, ge=0, le=1000000)
    relative_tolerance: float = Field(default=0, ge=0, le=1)
    array_order: str = Field(default="ordered", pattern="^(ordered|unordered)$")
    ignore_extra_fields: bool = False
