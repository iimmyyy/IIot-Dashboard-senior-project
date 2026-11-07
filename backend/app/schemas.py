from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Role = Literal["professor", "researcher", "staff"]
MeasurementStatus = Literal["draft", "submitted", "validated", "certified", "rejected"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class MembershipOut(BaseModel):
    project_id: str
    project_code: str
    project_name: str
    role: Role


class UserOut(BaseModel):
    id: str
    username: str
    display_name: str
    role: Role
    is_system_admin: bool
    memberships: list[MembershipOut]


class AuthOut(BaseModel):
    user: UserOut
    csrf_token: str
    expires_at: datetime


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    description: str | None


class ExperimentCreate(StrictModel):
    project_id: str
    reactor_id: str
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    conditions: str = Field(default="", max_length=4000)
    historical_label: str | None = Field(default=None, max_length=120)


class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    reactor_id: str
    code: str
    name: str
    status: Literal["running", "completed"]
    start_at: datetime
    end_at: datetime | None
    conditions: str
    historical_label: str | None


class MeasurementValues(StrictModel):
    temperature_top_c: float | None = Field(default=None, ge=-50, le=200)
    temperature_middle_c: float | None = Field(default=None, ge=-50, le=200)
    temperature_bottom_c: float | None = Field(default=None, ge=-50, le=200)
    temperature_core_c: float | None = Field(default=None, ge=-50, le=200)
    temperature_air_c: float | None = Field(default=None, ge=-50, le=200)
    below_peak_c: float | None = None
    bottom_slope_c_per_day: float | None = None
    drying_rate_kg_per_day: float | None = None
    eta: float | None = None
    nl_kg: float | None = None
    total_weight_kg: float | None = Field(default=None, ge=0)
    leachate_kg: float | None = Field(default=None, ge=0)
    height_m: float | None = Field(default=None, ge=0)
    ar_m3_per_kg_per_day: float | None = Field(default=None, ge=0)
    oxygen_core_percent: float | None = Field(default=None, ge=0, le=100)
    carbon_dioxide_core_percent: float | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def at_least_one_value(self) -> "MeasurementValues":
        if not any(value is not None for value in self.model_dump().values()):
            raise ValueError("Enter at least one collected measurement.")
        return self


class MeasurementCreate(StrictModel):
    experiment_id: str
    record_date: date
    historical_label: str = Field(default="current", min_length=1, max_length=120)
    values: MeasurementValues
    revision_reason: str = Field(default="Initial entry", min_length=3, max_length=500)


class MeasurementUpdate(StrictModel):
    values: MeasurementValues
    revision_reason: str = Field(min_length=3, max_length=500)


class MeasurementOut(BaseModel):
    id: str
    project_id: str
    reactor_id: str
    experiment_id: str
    record_date: date
    historical_label: str
    values: MeasurementValues
    status: MeasurementStatus
    revision: int
    created_by_id: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    validated_at: datetime | None
    certified_at: datetime | None
    rejection_reason: str | None


class TransitionInput(StrictModel):
    comment: str | None = Field(default=None, max_length=1000)


class CompletionRequestCreate(StrictModel):
    rationale: str = Field(min_length=10, max_length=4000)


class CompletionReview(StrictModel):
    comment: str = Field(min_length=3, max_length=2000)


class CompletionRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    experiment_id: str
    status: Literal["pending", "approved", "rejected"]
    rationale: str
    requested_by_id: str
    requested_at: datetime
    reviewed_by_id: str | None
    reviewed_at: datetime | None
    review_comment: str | None


class ActionItemOut(BaseModel):
    id: str
    kind: Literal["measurement_validation", "measurement_certification", "completion_approval"]
    title: str
    status: str
    project_id: str
    target_id: str
    occurred_at: datetime


class ActionHistoryOut(BaseModel):
    id: str
    action: str
    title: str
    status: str
    project_id: str
    experiment_id: str | None
    target_id: str
    occurred_at: datetime
    actor_id: str
    actor_name: str
    reviewer_name: str | None


class SupportingValue(BaseModel):
    label: str
    value: str


class AlertOut(BaseModel):
    id: str
    experiment_id: str
    kind: str
    title: str
    description: str
    action: str
    severity: Literal["info", "warning", "critical"]
    detected_at: datetime
    supporting_values: list[SupportingValue]
    acknowledged_at: datetime | None
    acknowledged_by: str | None
    resolved_at: datetime | None


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str | None
    actor_id: str | None
    action: str
    target_type: str
    target_id: str
    occurred_at: datetime
    details: dict[str, object]


class HealthOut(BaseModel):
    status: Literal["ok"]
    database: Literal["connected"]
    time: datetime

