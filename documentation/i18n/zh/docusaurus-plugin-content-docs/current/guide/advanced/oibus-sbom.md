---
sidebar_position: 4
---

# 软件物料清单（SBOM）

**软件物料清单（Software Bill of Materials，SBOM）**是构成软件产品的所有组件、库
和依赖项的机器可读清单——包括它们的版本、许可证以及供应链
关系。安全团队、合规负责人和漏洞扫描工具使用 SBOM 来
评估软件部署的风险敞口。

## 格式 {#format}

OIBus 以 **[CycloneDX](https://cyclonedx.org/) JSON** 格式发布其 SBOM，使用
[`cdxgen`](https://github.com/CycloneDX/cdxgen) 生成。CycloneDX 是一个由 OWASP 支持的
广泛采用的开放标准，在整个安全生态系统中拥有原生工具支持。

该 SBOM 覆盖整个代码仓库（后端、前端和 launcher），并在每次发布构建时
从头重新生成。

## 下载 SBOM {#downloading-the-sbom}

对于每个稳定版本，SBOM 都可以在两个位置获取：

### GitHub Releases（推荐） {#github-releases-recommended}

每个稳定版本都会附带 `oibus-sbom.json` 作为发布资源。你可以直接下载它：

```
https://github.com/OptimistikSAS/OIBus/releases/latest/download/oibus-sbom.json
```

对于特定版本，将 `latest` 替换为标签名：

```
https://github.com/OptimistikSAS/OIBus/releases/download/v3.x.y/oibus-sbom.json
```

所有发布资源都列在[发布页面](https://github.com/OptimistikSAS/OIBus/releases)上。

### 内置于二进制归档文件中 {#bundled-inside-the-binary-archive}

每个平台的归档文件（`oibus-win_x64-<version>.zip`、`oibus-linux_x64-<version>.zip` 等）都
包含 `oibus-sbom.json`，与二进制文件放在一起。如果你已经下载并解压了 OIBus，SBOM
文件已经存在于与 `oibus` 或 `oibus.exe` 可执行文件相同的目录中。

:::note
SBOM 仅附加在**稳定版**（非预发布）发布中。预发布构建会生成 SBOM
作为 CI 产物，但不会将其发布到发布页面。
:::

## 使用 SBOM {#using-the-sbom}

CycloneDX JSON 文件可被任何兼容工具使用。最常见的使用场景包括：

### 漏洞扫描 {#vulnerability-scanning}

| 工具                                                     | 命令                              |
| -------------------------------------------------------- | ------------------------------------ |
| **[Grype](https://github.com/anchore/grype)**            | `grype sbom:oibus-sbom.json`         |
| **[Trivy](https://trivy.dev/)**                          | `trivy sbom oibus-sbom.json`         |
| **[OSV-Scanner](https://google.github.io/osv-scanner/)** | `osv-scanner --sbom oibus-sbom.json` |

### 持续监控 {#continuous-monitoring}

[OWASP Dependency-Track](https://dependencytrack.org/) 接受 CycloneDX SBOM，并持续
针对多个漏洞数据库（NVD、OSV、GitHub Advisories
等）监控已上传的组件。通过其 REST API 或 Web 界面上传 `oibus-sbom.json`，即可随时间跟踪 OIBus 的风险状况。

### 许可证合规 {#license-compliance}

诸如 [FOSSA](https://fossa.com/) 和
[CycloneDX CLI](https://github.com/CycloneDX/cyclonedx-cli) 等工具可以解析 SBOM，以生成许可证
清单、标记 copyleft 依赖项，或生成合规报告。

### 查看 SBOM {#viewing-the-sbom}

要在不使用任何外部工具的情况下检查原始 SBOM，可以在文本编辑器中打开 `oibus-sbom.json`，或
通过 `jq` 对其进行管道处理：

```bash
jq '.components[] | {name, version, licenses}' oibus-sbom.json
```

## 生成流程 {#generation-process}

SBOM 由[构建流水线](https://github.com/OptimistikSAS/OIBus/blob/main/.github/workflows/build.yml)
在每次发布事件时自动生成，使用以下命令：

```bash
cdxgen . -o oibus-sbom.json --recurse
```

`--recurse` 标志确保嵌套的工作区（后端、前端、launcher）都被包含
在一份合并后的文档中。该流水线会在编译平台二进制文件之前运行此步骤，
因此 SBOM 始终反映用于生成该版本的确切依赖集。
