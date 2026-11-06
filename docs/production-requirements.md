# Production requirements

The local Compose stack is a development and research-workflow milestone, not an approved production deployment.

Before real deployment, the project owners must approve institutional identity and MFA, HTTPS ingress, secure-cookie/proxy settings, managed secrets, database least privilege, encrypted backup and restore drills, retention and deletion rules, monitoring, incident response, dependency/container scanning, capacity, and a supported upgrade process.

The deployment must also resolve the physical sensor inventory and L1/L2/L3 meaning, validate the scientific workflow and required fields, complete an independent authorization/session/CSRF review, and establish account recovery and offboarding. Notification delivery requires an approved provider, recipients, transactional outbox worker, retry/deduplication, and audit policy.

PLC, MQTT, and equipment control require a separate architecture and safety review. No future deployment should infer blower commands from this application’s research approvals or temperature criteria.
