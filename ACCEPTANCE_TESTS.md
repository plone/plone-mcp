# Acceptance Tests for Plone MCP

This document explains how to run acceptance tests both locally and on GitHub Actions.

## Overview

Acceptance tests verify the end-to-end functionality of the plone-mcp server by creating real pages on a Plone site and validating the results. These tests ensure that the "create a page 'Hello World'" functionality works correctly with proper title block generation.

## Local Testing

### Quick Start

```bash
# Run with default settings (kitconcept intranet)
npm run test:acceptance:all

# Run with debugging (keeps test pages)
npm run test:acceptance:debug

# Run against local Docker Plone
npm run test:acceptance:docker
```

### Manual Configuration

```bash
# Custom Plone site
./scripts/run-acceptance-tests.sh --url https://your-plone-site.com --user admin --pass secret

# Skip cleanup for debugging
./scripts/run-acceptance-tests.sh --skip-cleanup

# Use environment variables
export PLONE_TEST_URL="https://your-site.com"
export PLONE_TEST_USER="admin"
export PLONE_TEST_PASS="password"
./scripts/run-acceptance-tests.sh
```

### Docker Testing

The script can automatically start a local Plone instance using Docker:

```bash
# Starts Docker Plone and runs tests
npm run test:acceptance:docker

# Or manually
./scripts/run-acceptance-tests.sh --docker
```

This will:
1. Start `plone/plone-backend:6.0` container
2. Wait for Plone to be ready
3. Run acceptance tests against `http://localhost:8080/Plone`
4. Clean up the container

## GitHub Actions

### Workflow Overview

The project includes a comprehensive GitHub Actions workflow (`.github/workflows/acceptance-tests.yml`) that runs acceptance tests in multiple scenarios:

#### 1. **Standard Acceptance Tests**
- Runs on pull requests and manual dispatch
- Tests against external Plone site
- Supports multiple Node.js versions (18, 20)
- Uses environment variables for configuration

#### 2. **Docker-based Tests**
- Runs on manual dispatch only
- Starts ephemeral Plone container
- Tests against isolated Plone instance
- Includes container health checks

#### 3. **Functional Tests**
- Runs on manual dispatch only
- Tests broader functionality
- Uses real Plone connections

### Setting Up GitHub Secrets

For the acceptance tests to run on GitHub Actions, configure these repository secrets:

```
PLONE_TEST_URL=https://your-plone-site.com
PLONE_TEST_USER=your-username
PLONE_TEST_PASS=your-password
```

**Note**: If secrets are not configured, the workflow will fall back to the kitconcept intranet defaults.

### Manual Workflow Dispatch

You can manually trigger acceptance tests from the GitHub Actions tab:

1. Go to **Actions** tab in your repository
2. Select **Acceptance Tests** workflow
3. Click **Run workflow**
4. Configure options:
   - **Plone test site URL**: Override the default test site
   - **Skip test page cleanup**: Keep test pages for debugging

### Workflow Features

#### Security
- Only runs on non-fork PRs (prevents secret exposure)
- Supports manual dispatch for debugging
- Graceful handling of missing secrets

#### Multi-Environment Testing
- Tests against both external and Docker Plone instances
- Multiple Node.js versions for compatibility
- Isolated test execution with unique page IDs

#### Error Handling
- Comprehensive logging for CI debugging
- Automatic cleanup on failure
- Container log output on Docker test failures
- Test summary in GitHub Actions output

## Test Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLONE_TEST_URL` | Target Plone site URL | `https://plone-intranet.kitconcept.com` |
| `PLONE_TEST_USER` | Username for authentication | `admin` |
| `PLONE_TEST_PASS` | Password for authentication | `admin` |
| `SKIP_CLEANUP` | Skip test page cleanup | `false` |
| `CI` | Enable CI-specific logging | Auto-detected |
| `CI_RUN_ID` | GitHub Actions run ID | Auto-set in CI |

### Test Isolation

Tests are designed to avoid conflicts:
- **Unique page IDs**: Include timestamp and CI run ID
- **Automatic cleanup**: Deletes test pages after completion
- **Configurable cleanup**: Can be disabled for debugging
- **Path normalization**: Handles different Plone configurations

## Test Structure

### What Gets Tested

1. **Page Creation**: Creates Document with title "Hello World"
2. **Title Block Generation**: Verifies auto-generated `@type: "title"` block
3. **Block Structure**: Validates proper Volto blocks layout
4. **Page Accessibility**: Confirms page can be retrieved via API
5. **Frontend Compatibility**: Ensures Volto rendering requirements

### Test Assertions (22 total)

- ✅ **Basic Properties** (4): Title, type, URL, base URL
- ✅ **Block Structure** (4): Blocks object, layout, count, items
- ✅ **Title Block** (4): Type, minimal structure, no extra properties
- ✅ **Accessibility** (2): Page retrieval, blocks structure
- ✅ **Volto Compatibility** (8): Required properties, block type validation

## Debugging

### Local Debugging

```bash
# Keep test pages for manual inspection
npm run test:acceptance:debug

# Check the created page
# URL will be shown in test output: https://site.com/hello-world-test-[timestamp]
```

### CI Debugging

1. **Enable debug mode** in workflow dispatch:
   - Set "Skip test page cleanup" to `true`
   - Check test page URL in workflow logs

2. **Check workflow logs**:
   - Look for connection errors
   - Verify environment variables
   - Check test assertion failures

3. **Container debugging** (Docker tests):
   - Workflow includes container log output on failure
   - Health check status visible in logs

### Common Issues

#### Connection Timeouts
```bash
# Increase timeout
./scripts/run-acceptance-tests.sh --timeout 600
```

#### Permission Errors
```bash
# Verify credentials
curl -u admin:password https://your-site.com/++api++/
```

#### Rate Limiting
- Tests include automatic delays
- Use different test sites for parallel runs
- Consider Docker mode for isolated testing

## Integration with CI/CD

### Pull Request Workflow

1. **Unit/Integration Tests** run first (`npm run test:ci`)
2. **Acceptance Tests** run if secrets available
3. **Results** shown in PR checks and workflow summary

### Deployment Pipeline

```yaml
# Example workflow step
- name: Run Acceptance Tests
  run: npm run test:acceptance:all
  env:
    PLONE_TEST_URL: ${{ secrets.PLONE_TEST_URL }}
    PLONE_TEST_USER: ${{ secrets.PLONE_TEST_USER }}
    PLONE_TEST_PASS: ${{ secrets.PLONE_TEST_PASS }}
```

## Performance Considerations

### Test Duration
- **Local tests**: ~10-30 seconds
- **CI tests**: ~30-60 seconds
- **Docker tests**: ~2-3 minutes (includes container startup)

### Resource Usage
- Minimal impact on target Plone site
- Single page creation/deletion per test
- Automatic cleanup prevents accumulation

### Parallelization
- Tests use unique IDs to avoid conflicts
- Safe to run multiple instances simultaneously
- Matrix builds supported in GitHub Actions

## Troubleshooting

### Failed Tests

1. **Check test output** for specific assertion failures
2. **Verify connectivity** to target Plone site
3. **Confirm credentials** have sufficient permissions
4. **Review cleanup logs** for post-test issues

### GitHub Actions Issues

1. **Check secrets configuration** in repository settings
2. **Verify workflow permissions** for the repository
3. **Review workflow logs** for environment setup issues
4. **Test locally first** to isolate CI-specific problems

### Docker Issues

1. **Ensure Docker is running** and accessible
2. **Check port conflicts** (8080 must be available)
3. **Verify Docker image** availability
4. **Review container logs** in workflow output

For additional help, check the test logs and refer to the [main project README](README.md).