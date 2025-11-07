# Console

The **Console North Connector** displays filenames or values directly in the console output, making it ideal for \*
\*debugging and development purposes\*\*.

## Specific Settings

| Setting     | Description                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Verbose** | When enabled, displays received data in **detailed tables**. When disabled, only shows the **count of values** received. |

## Using the Console in Production

In production environments where OIBus runs as a service (Windows/Linux), follow these steps to view console output:

1. **Stop the OIBus service** using your OS service manager.
2. **Launch OIBus manually** from a terminal with administrative privileges:
   - **Windows**: Navigate to the installation folder and execute `go.bat`.
   - **Linux**: Navigate to the installation folder and run `go.sh`.
3. View the console output directly in the terminal.

:::caution Important
After debugging, remember to:

1. Exit the terminal session.
2. **Restart the OIBus service** using your OS service manager to resume normal operation.

:::

## Best Practices

- Use **verbose mode** during development or troubleshooting to inspect data structure and content.
- Do not use in production to reduce console clutter.
- For persistent data, consider using the [File Writer North Connector](../north-connectors/file-writer.md) instead of
  relying solely on console output.
