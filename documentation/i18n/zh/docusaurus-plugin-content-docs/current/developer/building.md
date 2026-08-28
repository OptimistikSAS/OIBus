---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# 构建 OIBus

OIBus 使用 [pkg 的一个分支](https://github.com/yao-pkg/pkg) 作为构建工具，用于创建特定平台的二进制文件。

:::caution pkg 版本说明
原始的 `pkg` 已被弃用。OIBus 使用一个与现代 Node.js 版本兼容的维护分支。
:::

## 📦 构建二进制文件 {#-building-binaries}

### 可用的构建命令 {#available-build-commands}

| 命令                         | 平台     | 架构          | 说明                                              |
| --------------------------- | -------- | ------------- | ------------------------------------------------ |
| `npm run build:win-x64`     | Windows  | x64           | 构建 Windows 可执行文件                            |
| `npm run build:linux-x64`   | Linux    | x64           | 为 x64 Linux 系统构建                              |
| `npm run build:linux-arm64` | Linux    | ARM64         | 为 ARM64 Linux 构建（树莓派 3 B+ 等）                |
| `npm run build:macos-x64`   | macOS    | Intel         | 为基于 Intel 的 Mac 构建                            |
| `npm run build:macos-arm64` | macOS    | Apple Silicon | 为 M1/M2 Mac 构建                                  |

### 构建流程详情 {#build-process-details}

1. **前置条件**：
   - 已安装 Node.js（版本见 `.nvmrc`）
   - 已安装所有依赖项（`npm install`）

2. **构建**：

   ```bash
   # 示例：为 Windows 构建
   npm run build:win

   # 输出目录：
   # ./dist/oibus-win-x64/
   ```

3. **构建输出**：
   - 二进制文件输出到 `dist/` 目录
   - 每个平台都有各自的子目录
   - 包含所有所需的资源和依赖项

## 🚀 启动二进制文件 {#-starting-the-binary}

### 可用的启动命令 {#available-start-commands}

| 命令                         | 平台                 | 说明                         |
| --------------------------- | -------------------- | ---------------------------- |
| `npm run start:win-x64`     | Windows              | 启动 Windows 二进制文件       |
| `npm run start:linux-x64`   | Linux                | 启动 Linux 二进制文件         |
| `npm run start:linux-arm64` | Linux ARM64          | 启动 ARM64 Linux 二进制文件   |
| `npm run start:macos-x64`   | macOS Intel          | 启动 Intel Mac 二进制文件     |
| `npm run start:macos-arm64` | macOS Apple Silicon  | 启动 Apple Silicon 二进制文件 |

### 数据文件夹 {#data-folder}

所有命令都使用 `data-folder` 作为以下内容的默认目录：

- 配置文件
- 缓存存储
- 日志文件
- 临时数据

## Windows 安装程序 {#windows-installer}

Windows 安装程序使用 [Inno Setup](https://jrsoftware.org/isinfo.php) 构建。

### 前置条件 {#prerequisites}

- Windows 操作系统
- 已安装 [Inno Setup](https://jrsoftware.org/isinfo.php)
- 用于证书操作的 OpenSSL

### 证书设置 {#certificate-setup}

#### 1. 创建配置文件 {#1-create-configuration-file}

创建包含以下内容的 `cert.conf`：

```ini
[ req ]
default_bits = 2048
default_md = sha256
distinguished_name = subject
req_extensions = req_ext
x509_extensions = req_ext
string_mask = utf8only
prompt = no

[ req_ext ]
basicConstraints = CA:FALSE
nsCertType = client, server
keyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyCertSign
extendedKeyUsage = serverAuth, clientAuth
nsComment = "OIBus Cert"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = URI:urn:oibus,IP:127.0.0.1

[ subject ]
countryName = FR
stateOrProvinceName = FR
localityName = Chambéry
organizationName = OI
commonName = oibus
```

#### 2. 生成证书文件 {#2-generate-certificate-files}

在 **PowerShell** 中运行以下命令：

```powershell
# 生成私钥和 CSR
openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf

# 创建自签名证书
openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt

# 转换为 PFX 格式
openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name "OIBus"

# 转换为 base64
$pfxContent = [System.Convert]::ToBase64String((Get-Content -Path "oibus.pfx" -Encoding Byte))
$pfxContent | Out-File -FilePath "oibus64.pfx" -Encoding ASCII
```

#### 3. 构建安装程序 {#3-build-the-installer}

```powershell
# 运行构建
npm run build:win-setup
```

### 安装程序构建流程 {#installer-build-process}

1. 脚本会：
   - 编译二进制文件（如果尚未构建）
   - 创建安装程序配置
   - 对可执行文件签名
   - 将所有内容打包成一个 `.exe` 安装程序

2. **输出**：
   - 安装程序位于 `dist/setup/`
   - 命名为 `OIBus-Setup-{version}.exe`
