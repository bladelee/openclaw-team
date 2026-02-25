# Multi-Tenant Instance Management - Test Plan

## Test Coverage Summary

This document outlines the test plan for the multi-tenant instance management features implemented according to `FEATURE_DESIGN.md`.

---

## 1. URL Configuration Tests (Phase 2)

### Unit Tests

#### `generateInstanceUrl()` Function
- **Test 1.1**: Default format `{name}.{baseDomain}` with https
  - Input: instanceName="test-prod"
  - Expected: `https://test-prod.openclaw.app`

- **Test 1.2**: Custom base domain
  - Config: INSTANCE_BASE_DOMAIN="example.com"
  - Input: instanceName="my-instance"
  - Expected: `https://my-instance.example.com`

- **Test 1.3**: Custom scheme
  - Config: INSTANCE_URL_SCHEME="http"
  - Input: instanceName="test"
  - Expected: `http://test.openclaw.app`

- **Test 1.4**: Custom format with path
  - Config: INSTANCE_URL_FORMAT="{baseDomain}/instance/{name}"
  - Input: instanceName="test"
  - Expected: `https://openclaw.app/instance/test`

#### Config Schema Validation
- **Test 1.5**: Valid config loads correctly
- **Test 1.6**: Invalid URL format falls back to default
- **Test 1.7**: Missing values use defaults

---

## 2. Chat Drawer Tests (Phase 3)

### Component Tests

#### ChatDrawer Component
- **Test 2.1**: Renders with correct default width (60%)
- **Test 2.2**: Opens when open prop is true
- **Test 2.3**: Closes when close button clicked
- **Test 2.4**: Closes on escape key press
- **Test 2.5**: Closes on backdrop click
- **Test 2.6**: Displays correct instance name in header
- **Test 2.7**: "New Window" button opens URL in new tab

#### ChatIframe Component
- **Test 2.8**: Shows loading spinner initially
- **Test 2.9**: Hides loading spinner on load
- **Test 2.10**: Shows error state on load failure
- **Test 2.11**: Has correct sandbox attributes
- **Test 2.12**: Has correct allow permissions

#### Drawer Component
- **Test 2.13**: Resizable with drag handle
- **Test 2.14**: Width clamps between 30% and 90%
- **Test 2.15**: Backdrop renders when open
- **Test 2.16**: Triggers onOpenChange callback

---

## 3. Custom Instance Registration Tests (Phase 4)

### Unit Tests

#### `validateCustomInstance()` Function
- **Test 3.1**: Cloud instance - valid URL returns urlValid=true
- **Test 3.2**: Cloud instance - with valid API token returns apiAccessible=true
- **Test 3.3**: Cloud instance - health check endpoint works
- **Test 3.4**: Hardware instance - IP:port connection works
- **Test 3.5**: Hardware instance - timeout after 10 seconds
- **Test 3.6**: Invalid URL returns error
- **Test 3.7**: Missing required fields returns validation error

#### `performHealthCheck()` Function
- **Test 3.8**: Healthy instance returns true and updates database
- **Test 3.9**: Unhealthy instance returns false and marks offline
- **Test 3.10**: Managed instances skip health check
- **Test 3.11**: Health check updates last_health_check timestamp

### API Integration Tests

#### POST /api/instances/custom
- **Test 3.12**: Register cloud instance successfully
- **Test 3.13**: Register hardware instance successfully
- **Test 3.14**: Reject without authentication
- **Test 3.15**: Validation error for missing name
- **Test 3.16**: Validation error for cloud instance without URL
- **Test 3.17**: Validation error for hardware instance without IP

#### POST /api/instances/custom/validate
- **Test 3.18**: Validate valid connection
- **Test 3.19**: Return validation results for all checks
- **Test 3.20**: Handle connection timeout

#### GET /api/instances/:id/health
- **Test 3.21**: Return health status for custom instance
- **Test 3.22**: Return 403 for non-owner
- **Test 3.23**: Return 404 for non-existent instance

---

## 4. Hardware Box Tests (Phase 5)

### Unit Tests

#### Local Network Scan
- **Test 4.1**: Scan returns empty array when no devices found
- **Test 4.2**: Scan discovers devices on local network
- **Test 4.3**: Scan respects timeout parameter
- **Test 4.4**: Scan limits to 254 IP addresses
- **Test 4.5**: Scan returns correct device structure

### UI Tests

#### Hardware Instance Display
- **Test 4.6**: Hardware instances show "硬件" badge
- **Test 4.7**: Hardware instances show IP address instead of URL
- **Test 4.8**: Offline hardware shows red status
- **Test 4.9**: Online hardware shows green status
- **Test 4.10**: "Scan Local Network" button triggers scan
- **Test 4.11**: Scan results display when devices found
- **Test 4.12**: Selecting device fills form with IP

---

## 5. Database Tests

### Schema Tests
- **Test 5.1**: Instance table has all new columns
- **Test 5.2**: source column defaults to 'managed'
- **Test 5.3**: Custom instance can be created with source='custom'
- **Test 5.4**: Hardware instance can be created with source='hardware'
- **Test 5.5**: last_health_check updates correctly
- **Test 5.6**: is_healthy field stores boolean correctly

---

## 6. Integration Tests

### End-to-End Flows

#### Flow 1: Create Managed Instance
- **Test 6.1**: User creates instance via dashboard
- **Test 6.2**: URL generated using config format
- **Test 6.3**: Container created with correct name
- **Test 6.4**: Instance appears in dashboard
- **Test 6.5**: Chat button opens drawer

#### Flow 2: Register Custom Cloud Instance
- **Test 6.6**: User opens custom instance modal
- **Test 6.7**: User enters cloud instance details
- **Test 6.8**: Validation passes for valid URL
- **Test 6.9**: Instance registered successfully
- **Test 6.10**: Instance shows "自定义" badge
- **Test 6.11**: Health check updates status

#### Flow 3: Register Hardware Box
- **Test 6.12**: User scans local network
- **Test 6.13**: Device discovered and displayed
- **Test 6.14**: User selects device
- **Test 6.15**: Form auto-fills with device IP
- **Test 6.16**: Hardware instance registered
- **Test 6.17**: Instance shows "硬件" badge

#### Flow 4: Chat Interaction
- **Test 6.18**: User clicks chat button
- **Test 6.19**: Drawer opens with 60% width
- **Test 6.20**: Iframe loads instance chat UI
- **Test 6.21**: User can interact with chat
- **Test 6.22**: New window button works
- **Test 6.23**: Close button works

---

## 7. Edge Cases and Error Handling

### Error Tests
- **Test 7.1**: Handle network timeout gracefully
- **Test 7.2**: Handle invalid URL format
- **Test 7.3**: Handle missing authentication
- **Test 7.4**: Handle database connection failure
- **Test 7.5**: Handle Portainer API failure
- **Test 7.6**: Handle concurrent chat drawer opens
- **Test 7.7**: Handle iframe load failure
- **Test 7.8**: Handle scan cancellation

---

## 8. Performance Tests

### Load Tests
- **Test 8.1**: Health check service handles 100+ instances
- **Test 8.2**: Local network scan completes within 30 seconds
- **Test 8.3**: Chat drawer renders without lag
- **Test 8.4**: Dashboard handles 50+ instances

---

## Test Files Structure

```
multi-tenant/
├── tenant-manager/
│   ├── src/
│   │   ├── config.test.ts
│   │   ├── instance-service.test.ts
│   │   ├── health-check.test.ts
│   │   └── routes.test.ts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatButton.test.tsx
│   │   │   │   ├── ChatDrawer.test.tsx
│   │   │   │   └── ChatIframe.test.tsx
│   │   │   └── ui/
│   │   │       ├── drawer.test.tsx
│   │   │       └── tooltip.test.tsx
│   │   ├── lib/
│   │   │   └── api/
│   │   │       └── tenants.test.ts
│   │   └── app/
│   │       └── dashboard/
│   │           └── page.test.tsx
```

---

## Priority Matrix

| Test Category | Priority | Status |
|--------------|----------|--------|
| URL Configuration (1.1-1.7) | High | Pending |
| Chat Drawer Components (2.1-2.16) | High | Pending |
| Custom Instance Validation (3.1-3.11) | High | Pending |
| Custom Instance APIs (3.12-3.23) | High | Pending |
| Hardware Box (4.1-4.12) | Medium | Pending |
| Database Schema (5.1-5.6) | High | Pending |
| Integration Flows (6.1-6.23) | High | Pending |
| Edge Cases (7.1-7.8) | Medium | Pending |
| Performance (8.1-8.4) | Low | Pending |

---

## Implementation Notes

### Missing Components (Design vs Implementation)
1. **CORS Configuration** - Design mentions `CORS_ALLOWED_ORIGINS` env var, not implemented
2. **ChatLoading.tsx** - Design specified separate component, implemented inline in ChatIframe
3. **Database Migration SQL** - Schema defined in TypeScript, no migration scripts created
4. **Resizable Component** - Design specified separate component, implemented in Drawer

### Recommendations
1. Add database migration scripts for production deployment
2. Implement CORS configuration for production instances
3. Add integration tests for full user flows
4. Add E2E tests with Playwright or Cypress
5. Mock Portainer API in tests for reliability
