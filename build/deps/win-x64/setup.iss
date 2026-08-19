; --- Dynamic Definitions ---

; 1. Handle Application Version
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-LOCAL"
#endif

; --- Standard Definitions ---
#define MyAppName "OIBus"
#define MyAppPublisher "Optimistik SAS"
#define MyAppURL "https://oibus.optimistik.com/"
#define PublisherURL "https://optimistik.com/"
#define GitHubURL "https://github.com/OptimistikSAS/OIBus"
#define MyDateTime GetDateTimeString('yyyy/mm/dd hh:nn:ss', '-', ':')

[Setup]
; --- Signing Configuration ---
#ifdef EnableSigning
  SignedUninstaller=yes
  ; Use the "KMSSign" tool.
    ; The definition of this tool is passed via the command line (/SKMSSign=...)
    SignTool=KMSSign $f
#else
  SignedUninstaller=no
#endif

; App Metadata
AppId=A4DCC920-510F-4D9D-AD02-67AA402EC010
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#PublisherURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Architecture & Paths
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DefaultDirName={autopf}\{#MyAppName}
OutputDir=..\..\bin\win-setup-release
OutputBaseFilename=oibus-setup

; Settings
Compression=lzma
SolidCompression=yes
DirExistsWarning=yes
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=admin
UsePreviousAppDir=no
UserInfoPage=no

; Visuals
SetupIconFile=..\..\..\frontend\public\favicon.ico
WizardImageFile=installer_oibus.bmp
WizardSmallImageFile=installer_small.bmp
WizardStyle=modern
WizardSizePercent=100
LicenseFile=..\..\..\LICENSE

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Dirs]
Name: {app}\binaries
Name: {app}\update
Name: {app}\backup

[Files]
Source: "..\..\bin\win-x64\binaries\oibus.exe"; DestDir: "{app}\binaries"; Flags: ignoreversion
Source: "..\..\bin\win-x64\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\bin\win-x64\oibus-launcher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\bin\win-x64\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
#ifdef EnableSigning
  Source: "..\..\bin\win-x64\oibus-sbom.json"; DestDir: "{app}"; Flags: ignoreversion
#endif

[Registry]
; We use the dynamic {code:GetServiceName} to create a unique registry key for this service instance
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Services\{code:GetServiceName}"; ValueType: string; ValueName: "DataDir"; ValueData: "{code:GetDataDir}"; Flags: uninsdeletevalue

; Machine-wide directory of every installed OIBus instance, independent of any single
; instance's own {app} folder. Used to make sure two instances never end up sharing the
; same binaries or data folder. Cleaned up automatically when this instance is uninstalled.
Root: HKLM; Subkey: "SOFTWARE\OIBus\Instances\{code:GetServiceName}"; ValueType: string; ValueName: "AppDir"; ValueData: "{app}"; Flags: uninsdeletevalue uninsdeletekeyifempty
Root: HKLM; Subkey: "SOFTWARE\OIBus\Instances\{code:GetServiceName}"; ValueType: string; ValueName: "DataDir"; ValueData: "{code:GetDataDir}"; Flags: uninsdeletevalue

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%n%nIMPORTANT:%nOIBus requires a modern web browser for configuration (Chrome, Firefox, Edge, Safari, etc.). Internet Explorer is not supported.

[UninstallDelete]
Name: "{app}\install.log"; Type: files
Name: "{app}\go.bat"; Type: files
; We must delete the service name file used by the uninstaller
Name: "{app}\service.name"; Type: files

Name: "{app}\binaries"; Type: filesandordirs
Name: "{app}\update"; Type: filesandordirs
Name: "{app}\backup"; Type: filesandordirs
Name: "{app}"; Type: dirifempty

[Code]
var
  OverwriteConfig: boolean;
  ConfExists: boolean;

  // Custom Page UI Elements
  ConfigPage: TWizardPage;
  ServiceNameEdit: TNewEdit;
  DataDirEdit: TNewEdit;

  AdminPage: TWizardPage;
  AdminUsernameEdit: TNewEdit;
  AdminPasswordEdit: TNewEdit;
  PortEdit: TNewEdit;

  // Global variables to store user choices
  FinalServiceName: String;
  FinalDataDir: String;
  FinalAdminUsername: String;
  FinalAdminPassword: String;
  FinalPort: String;

// --- Getter Functions for [Registry] ---

function GetDataDir(Param: String): String;
begin
  Result := FinalDataDir;
end;

function GetServiceName(Param: String): String;
begin
  Result := FinalServiceName;
end;

// --- Helper Functions ---

function ExecCmd(Prog: string; Params: string; WorkingDir: string): Boolean;
var
  ResultCode: Integer;
begin
  if ShellExec('', Prog, Params, WorkingDir, SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := True
  else
  begin
    MsgBox('ERROR: Failed to execute: ' + Prog + ' ' + Params + #13#10 + 'Error-message: ' + SysErrorMessage(ResultCode), mbError, MB_OK);
    Result := False;
  end;
end;

// --- Instance Isolation ---
// Every instance gets its own binaries folder AND its own data folder; the two must never
// be shared between instances. "SOFTWARE\OIBus\Instances\<name>" (written via [Registry])
// is the machine-wide directory of already-installed instances we check against.

const
  InstancesRegKey = 'SOFTWARE\OIBus\Instances';

// The service name ends up as a Windows service name, a registry key path segment, and a
// raw argument to sc.exe/nssm.exe - so anything outside this safe set (quotes, backslashes,
// ...) could corrupt those commands or break out of their intended argument. Reject it
// outright rather than trying to escape it differently for every consumer.
function IsValidServiceName(const S: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := Length(S) > 0;
  if not Result then Exit;
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if not (((C >= 'A') and (C <= 'Z')) or ((C >= 'a') and (C <= 'z')) or
            ((C >= '0') and (C <= '9')) or (C = ' ') or (C = '.') or (C = '_') or (C = '-')) then
    begin
      Result := False;
      Exit;
    end;
  end;
end;

// Strips characters that are illegal in a Windows path component, for use when deriving a
// suggested folder name from a free-text service name.
function SanitizeDirName(const S: String): String;
var
  I: Integer;
  C: Char;
  Cleaned: String;
begin
  Cleaned := '';
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if (C = '\') or (C = '/') or (C = ':') or (C = '*') or (C = '?') or (C = '"') or (C = '<') or (C = '>') or (C = '|') then
      Cleaned := Cleaned + '_'
    else
      Cleaned := Cleaned + C;
  end;
  Result := Trim(Cleaned);
end;

// True if some OTHER already-installed instance (any recorded name except IgnoreName) has
// ValueName equal to CompareValue (path comparison, case-insensitive, trailing-backslash
// insensitive) under its own SOFTWARE\OIBus\Instances\<name> key. Sets OwnerName to that
// other instance's service name.
function FindConflictingInstance(const ValueName, CompareValue, IgnoreName: String; var OwnerName: String): Boolean;
var
  Names: TArrayOfString;
  I: Integer;
  ExistingValue: String;
  Normalized: String;
begin
  Result := False;
  Normalized := RemoveBackslashUnlessRoot(CompareValue);

  if not RegGetSubkeyNames(HKLM, InstancesRegKey, Names) then
    Exit;

  for I := 0 to GetArrayLength(Names) - 1 do
  begin
    if CompareText(Names[I], IgnoreName) = 0 then Continue;

    if RegQueryStringValue(HKLM, InstancesRegKey + '\' + Names[I], ValueName, ExistingValue) then
    begin
      if CompareText(RemoveBackslashUnlessRoot(ExistingValue), Normalized) = 0 then
      begin
        OwnerName := Names[I];
        Result := True;
        Exit;
      end;
    end;
  end;
end;

// --- Multi-Instance Service Manifest ---
// {app}\service.name lists every service instance (one per line) that shares this
// installation's binaries folder, so the Uninstaller can find and clean up ALL of them
// instead of only the one installed most recently.

function GetServiceManifestPath(): String;
begin
  Result := ExpandConstant('{app}\service.name');
end;

// Loads the manifest into Names. Caller must free Names.
procedure LoadServiceManifest(Names: TStringList);
begin
  Names.Clear;
  if FileExists(GetServiceManifestPath()) then
    Names.LoadFromFile(GetServiceManifestPath());
  // Backward compatibility / safety net: very old installs (or a manually cleared file)
  // may have no manifest at all even though the default service is present.
  if Names.Count = 0 then
    Names.Add('OIBus');
end;

procedure AddServiceNameToManifest(const ServiceName: String);
var
  Names: TStringList;
begin
  Names := TStringList.Create;
  try
    if FileExists(GetServiceManifestPath()) then
      Names.LoadFromFile(GetServiceManifestPath());
    if Names.IndexOf(ServiceName) = -1 then
      Names.Add(ServiceName);
    Names.SaveToFile(GetServiceManifestPath());
  finally
    Names.Free;
  end;
end;

// --- UI Logic (Service Name + Data Dir Page) ---

procedure OnBrowseButtonClick(Sender: TObject);
var
  Dir: String;
begin
  Dir := DataDirEdit.Text;
  if BrowseForFolder('Select OIBus Data Directory', Dir, True) then
  begin
    DataDirEdit.Text := Dir;
  end;
end;

procedure InitializeWizard();
var
  lblService, lblData, lblAdminUser, lblAdminPass, lblPort: TNewStaticText;
  btnBrowse: TButton;
begin
  // Create the Custom Page. Anchored right after the License page (i.e. BEFORE the native
  // Select Destination Directory page) so that once the service name is known, we can
  // suggest a non-colliding default install folder before that page is even shown.
  ConfigPage := CreateCustomPage(wpLicense, 'Service Configuration', 'Configure the Windows Service and Data Storage');

  // 1. Service Name Section
  lblService := TNewStaticText.Create(ConfigPage);
  lblService.Parent := ConfigPage.Surface;
  lblService.Caption := 'Service Name (Unique name for this instance):';
  lblService.Top := 0;
  lblService.Left := 0;
  lblService.Width := ConfigPage.SurfaceWidth;

  ServiceNameEdit := TNewEdit.Create(ConfigPage);
  ServiceNameEdit.Parent := ConfigPage.Surface;
  ServiceNameEdit.Text := 'OIBus'; // Default Value
  ServiceNameEdit.Top := lblService.Top + lblService.Height + ScaleY(8);
  ServiceNameEdit.Left := 0;
  ServiceNameEdit.Width := ConfigPage.SurfaceWidth;

  // 2. Data Directory Section
  lblData := TNewStaticText.Create(ConfigPage);
  lblData.Parent := ConfigPage.Surface;
  lblData.Caption := 'Data Directory (Where configuration and logs are stored):';
  lblData.Top := ServiceNameEdit.Top + ServiceNameEdit.Height + ScaleY(20);
  lblData.Left := 0;
  lblData.Width := ConfigPage.SurfaceWidth;

  btnBrowse := TButton.Create(ConfigPage);
  btnBrowse.Parent := ConfigPage.Surface;
  btnBrowse.Caption := 'Browse...';
  btnBrowse.Width := ScaleX(75);
  btnBrowse.Height := ScaleY(23);
  btnBrowse.Left := ConfigPage.SurfaceWidth - btnBrowse.Width; // Align right
  btnBrowse.Top := lblData.Top + lblData.Height + ScaleY(8);
  btnBrowse.OnClick := @OnBrowseButtonClick;

  DataDirEdit := TNewEdit.Create(ConfigPage);
  DataDirEdit.Parent := ConfigPage.Surface;
  DataDirEdit.Text := 'C:\OIBusData'; // Default Value
  DataDirEdit.Top := btnBrowse.Top;
  DataDirEdit.Left := 0;
  DataDirEdit.Width := ConfigPage.SurfaceWidth - btnBrowse.Width - ScaleX(10);

  // Create Admin Credentials Page
  AdminPage := CreateCustomPage(ConfigPage.ID, 'Admin Credentials', 'Set the initial admin username, password and port');

  lblAdminUser := TNewStaticText.Create(AdminPage);
  lblAdminUser.Parent := AdminPage.Surface;
  lblAdminUser.Caption := 'Admin username (default: admin):';
  lblAdminUser.Top := 0;
  lblAdminUser.Left := 0;
  lblAdminUser.Width := AdminPage.SurfaceWidth;

  AdminUsernameEdit := TNewEdit.Create(AdminPage);
  AdminUsernameEdit.Parent := AdminPage.Surface;
  AdminUsernameEdit.Text := 'admin';
  AdminUsernameEdit.Top := lblAdminUser.Top + lblAdminUser.Height + ScaleY(8);
  AdminUsernameEdit.Left := 0;
  AdminUsernameEdit.Width := AdminPage.SurfaceWidth;

  lblAdminPass := TNewStaticText.Create(AdminPage);
  lblAdminPass.Parent := AdminPage.Surface;
  lblAdminPass.Caption := 'Admin password (default: pass):';
  lblAdminPass.Top := AdminUsernameEdit.Top + AdminUsernameEdit.Height + ScaleY(20);
  lblAdminPass.Left := 0;
  lblAdminPass.Width := AdminPage.SurfaceWidth;

  AdminPasswordEdit := TNewEdit.Create(AdminPage);
  AdminPasswordEdit.Parent := AdminPage.Surface;
  AdminPasswordEdit.PasswordChar := '*';
  AdminPasswordEdit.Text := 'pass';
  AdminPasswordEdit.Top := lblAdminPass.Top + lblAdminPass.Height + ScaleY(8);
  AdminPasswordEdit.Left := 0;
  AdminPasswordEdit.Width := AdminPage.SurfaceWidth;

  lblPort := TNewStaticText.Create(AdminPage);
  lblPort.Parent := AdminPage.Surface;
  lblPort.Caption := 'Port OIBus will listen on (default: 2223):';
  lblPort.Top := AdminPasswordEdit.Top + AdminPasswordEdit.Height + ScaleY(20);
  lblPort.Left := 0;
  lblPort.Width := AdminPage.SurfaceWidth;

  PortEdit := TNewEdit.Create(AdminPage);
  PortEdit.Parent := AdminPage.Surface;
  PortEdit.Text := '2223';
  PortEdit.Top := lblPort.Top + lblPort.Height + ScaleY(8);
  PortEdit.Left := 0;
  PortEdit.Width := AdminPage.SurfaceWidth;
end;

// Escape a string for safe embedding in a JSON value.
function EscapeJsonString(const S: String): String;
var
  I: Integer;
  C: Char;
  Escaped: String;
begin
  Escaped := '';
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if C = '\' then
      Escaped := Escaped + '\\'
    else if C = '"' then
      Escaped := Escaped + '\"'
    else
      Escaped := Escaped + C;
  end;
  Result := Escaped;
end;

// Hide the AdminPage when upgrading over an existing database.
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = AdminPage.ID) and ConfExists and not OverwriteConfig then
    Result := True;
end;

// --- Validation & Overwrite Check ---

function NextButtonClick(CurPageID: Integer): Boolean;
var
  SettingsFile: string;
  ConflictOwner: string;
begin
  Result := True;

  if (CurPageID = ConfigPage.ID) then
  begin
    // 1. Capture values
    FinalServiceName := ServiceNameEdit.Text;
    FinalDataDir := DataDirEdit.Text;

    // 2. Validation
    if Length(FinalServiceName) = 0 then
    begin
      MsgBox('You must enter a Service Name.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if not IsValidServiceName(FinalServiceName) then
    begin
      MsgBox('The service name may only contain letters, digits, spaces, dots, hyphens and underscores.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if Length(FinalDataDir) = 0 then
    begin
      MsgBox('You must enter a Data Directory.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // A literal " could break out of the quoted arguments it is later embedded in (nssm
    // AppParameters, go.bat) - and it is not a legal Windows path character anyway, so
    // rejecting it costs nothing legitimate.
    if Pos('"', FinalDataDir) > 0 then
    begin
      MsgBox('The data directory must not contain a " character.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // 3. Each instance must have its own data directory: reject one already claimed by a
    // DIFFERENT instance outright, before the generic "found a config, reuse it?" prompt
    // below gets a chance to offer reusing data that actually belongs to another service.
    if FindConflictingInstance('DataDir', FinalDataDir, FinalServiceName, ConflictOwner) then
    begin
      MsgBox('The data directory "' + FinalDataDir + '" is already used by another OIBus instance ("' + ConflictOwner + '").' + #13#10 +
             'Each OIBus instance must have its own data directory. Please choose a different one.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // 4. Overwrite Check
    SettingsFile := AddBackslash(FinalDataDir) + 'oibus.db';
    if FileExists(SettingsFile) then
    begin
      ConfExists := True;
      if MsgBox('A configuration file was found at ' + FinalDataDir + '. Do you want to use it?', mbInformation, MB_YESNO) = IDNO then
      begin
        if MsgBox('WARNING: Overwriting the current setup will delete all credentials, logs and data.' + #13#10 + 'Are you sure you want to proceed?', mbInformation, MB_YESNO) = IDNO then
          OverwriteConfig := False
        else
          OverwriteConfig := True
      end
      else
        OverwriteConfig := False;
    end;

    // 5. Suggest an install folder that won't collide with another instance. The default
    // service name keeps the classic path (clean upgrade story); any custom name gets its
    // own suffixed folder so multiple instances never end up sharing one {app}. This is
    // only a suggestion on the upcoming Select Destination Directory page - still editable,
    // and still re-checked for conflicts when that page is left (see below).
    if CompareText(FinalServiceName, 'OIBus') = 0 then
      WizardForm.DirEdit.Text := ExpandConstant('{autopf}') + '\OIBus'
    else
      WizardForm.DirEdit.Text := ExpandConstant('{autopf}') + '\OIBus - ' + SanitizeDirName(FinalServiceName);
  end;

  if (CurPageID = wpSelectDir) then
  begin
    // Each instance must have its own binaries folder: reject one already claimed by a
    // DIFFERENT instance. Reinstalling/upgrading the SAME instance into its own existing
    // folder is fine (FindConflictingInstance ignores the entry matching FinalServiceName).
    if FindConflictingInstance('AppDir', ExpandConstant('{app}'), FinalServiceName, ConflictOwner) then
    begin
      MsgBox('The folder "' + ExpandConstant('{app}') + '" is already used by another OIBus instance ("' + ConflictOwner + '").' + #13#10 +
             'Each OIBus instance must have its own installation folder. Please choose a different one.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;

  if (CurPageID = AdminPage.ID) then
  begin
    FinalAdminUsername := AdminUsernameEdit.Text;
    if Length(FinalAdminUsername) = 0 then FinalAdminUsername := 'admin';
    FinalAdminPassword := AdminPasswordEdit.Text;
    if Length(FinalAdminPassword) = 0 then FinalAdminPassword := 'pass';
    FinalPort := PortEdit.Text;
    if Length(FinalPort) = 0 then FinalPort := '2223';
  end;
end;

// --- Installation Logic ---

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  S: String;
begin
  S := '';

  // Add standard Destination Directory info
  if MemoDirInfo <> '' then
    S := S + MemoDirInfo + NewLine + NewLine;

  // Add our Custom Service Configuration info
  S := S + 'Service Configuration:' + NewLine;
  S := S + Space + 'Service Name: ' + FinalServiceName + NewLine;
  S := S + Space + 'Data Directory: ' + FinalDataDir + NewLine;
  S := S + Space + 'Admin Username: ' + FinalAdminUsername + NewLine;
  S := S + Space + 'Port: ' + FinalPort + NewLine;

  Result := S;
end;

function InstallProgram(): Boolean;
var
  LogPath, AppDir, NssmPath, LauncherPath: string;
begin
  Result := False;
  AppDir := ExpandConstant('{app}');
  NssmPath := AppDir + '\nssm.exe';
  LauncherPath := AppDir + '\oibus-launcher.exe';
  LogPath := AppDir + '\install.log';

  SaveStringToFile(LogPath, '{#MyDateTime}' + #13#10, True);

  // 1. Stop (Safety check)
  ExecCmd(NssmPath, 'stop "' + FinalServiceName + '"', AppDir);

  // 2. Install Service with Dynamic Name
  if not ExecCmd(NssmPath, 'install "' + FinalServiceName + '" "' + LauncherPath + '" "--config ""' + FinalDataDir + '"""', AppDir) then Exit;

  // 3. Configure Service
  ExecCmd(NssmPath, 'set "' + FinalServiceName + '" DisplayName "' + FinalServiceName + ' (OIBus Collector)"', AppDir);
  if not ExecCmd(NssmPath, 'set "' + FinalServiceName + '" Application "' + LauncherPath + '"', AppDir) then Exit;
  if not ExecCmd(NssmPath, 'set "' + FinalServiceName + '" AppParameters "--config ""' + FinalDataDir + '"""', AppDir) then Exit;
  if not ExecCmd(NssmPath, 'set "' + FinalServiceName + '" AppDirectory "' + AppDir + '"', AppDir) then Exit;

  ExecCmd(NssmPath, 'set "' + FinalServiceName + '" AppNoConsole 1', AppDir);

  // 4. Start Service
  if not ExecCmd(NssmPath, 'start "' + FinalServiceName + '"', AppDir) then
  begin
     MsgBox('Warning: The OIBus service failed to start automatically. Please try starting it from Windows Services.', mbError, MB_OK);
  end;

  Result := True;
end;

function CreateLauncherFile: Boolean;
var
  FileContent: string;
  AppDir: string;
begin
  AppDir := ExpandConstant('{app}');
  FileContent := '@echo off' + #13#10
        + 'echo Stopping ' + FinalServiceName + ' service...' + #13#10
        + '"' + AppDir + '\nssm.exe" stop "' + FinalServiceName + '"' + #13#10
        + '"' + AppDir + '\oibus-launcher.exe" --config "' + FinalDataDir + '"' + #13#10
        + 'pause';
  Result := SaveStringToFile(AppDir + '\go.bat', FileContent, False);
end;

function DeleteDataDir(DirToDelete: string): Boolean;
var
  CacheFolder, LogsFolder, CertsFolder, SettingsFile, CryptoFile: string;
begin
    CacheFolder := AddBackslash(DirToDelete) + 'cache';
    LogsFolder := AddBackslash(DirToDelete) + 'logs';
    CertsFolder := AddBackslash(DirToDelete) + 'certs';
    SettingsFile := AddBackslash(DirToDelete) + 'oibus.db';
    CryptoFile := AddBackslash(DirToDelete) + 'crypto.db';

    if DirExists(CacheFolder) then DelTree(CacheFolder, True, True, True);
    if DirExists(LogsFolder) then DelTree(LogsFolder, True, True, True);
    if DirExists(CertsFolder) then DelTree(CertsFolder, True, True, True);
    if FileExists(SettingsFile) then DeleteFile(SettingsFile);
    if FileExists(CryptoFile) then DeleteFile(CryptoFile);
    Result := True;
end;

function CreateDataDir: Boolean;
begin
  Result := True;
  if (OverwriteConfig and DirExists(FinalDataDir)) then
  begin
     DeleteDataDir(FinalDataDir);
  end;

  if not DirExists(FinalDataDir) then
    if not ForceDirectories(FinalDataDir) then Result := False;
end;

// --- Step Change Events ---

procedure CurStepChanged(CurStep: TSetupStep);
var
  LegacySvcName: String;
  LegacySvcNameAnsi: AnsiString;
begin
  if CurStep = ssInstall then
  begin
     // Initialize default
     LegacySvcName := 'OIBus';

     // Try to load existing name if available
     if FileExists(ExpandConstant('{app}\service.name')) then
     begin
        // Load into AnsiString buffer first
        if LoadStringFromFile(ExpandConstant('{app}\service.name'), LegacySvcNameAnsi) then
        begin
            LegacySvcName := String(LegacySvcNameAnsi);
        end;
     end;

     // The binaries folder is shared across instances (multiple named services can point
     // at it), so the previously recorded service name may belong to a DIFFERENT, still
     // wanted instance. Only stop/delete it when it's actually the same service being
     // reinstalled/renamed under the name we are about to (re)create; never touch another
     // instance's service just because it happens to share this install folder.
     if CompareText(LegacySvcName, FinalServiceName) = 0 then
     begin
       ExecCmd('sc.exe', 'stop "' + LegacySvcName + '"', '');
       Sleep(1000);
       ExecCmd('sc.exe', 'delete "' + LegacySvcName + '"', '');
     end;
  end;

  if CurStep = ssPostInstall then
  begin
    // Record this service name in the shared manifest for the Uninstaller. The binaries
    // folder is shared across instances, so we APPEND (deduplicated) rather than overwrite:
    // the uninstaller needs to know about every instance that depends on these files, not
    // just the one that happened to be installed most recently.
    AddServiceNameToManifest(FinalServiceName);

    if not CreateDataDir then
      MsgBox('ERROR : OIBus data directory Setup failed.', mbCriticalError, MB_OK)
    else begin
      // Write init config file only when no existing database is present
      if not FileExists(AddBackslash(FinalDataDir) + 'oibus.db') then
        SaveStringToFile(
          AddBackslash(FinalDataDir) + 'oibus.init.json',
          '{"engineName":"' + EscapeJsonString(FinalServiceName) + '","adminUsername":"' + EscapeJsonString(FinalAdminUsername) + '","adminPassword":"' + EscapeJsonString(FinalAdminPassword) + '","port":' + FinalPort + '}',
          False
        );

      if not CreateLauncherFile() then
        MsgBox('ERROR : Launcher file creation failed', mbCriticalError, MB_OK)
      else if not InstallProgram() then
        MsgBox('ERROR : Installation has failed', mbCriticalError, MB_OK);
    end;
  end;
end;

// --- Uninstallation Logic ---

// Warn upfront (before anything is touched) when this install folder is shared by more
// than one service instance, since uninstalling removes the binaries ALL of them depend
// on. Gives the user a chance to back out if they only meant to remove one instance.
function InitializeUninstall(): Boolean;
var
  Names: TStringList;
  Msg: String;
  I: Integer;
begin
  Result := True;
  Names := TStringList.Create;
  try
    LoadServiceManifest(Names);
    if Names.Count > 1 then
    begin
      Msg := 'This OIBus installation folder is shared by multiple service instances:' + #13#10#13#10;
      for I := 0 to Names.Count - 1 do
        Msg := Msg + '   - ' + Names[I] + #13#10;
      Msg := Msg + #13#10 + 'Uninstalling removes the program files shared by ALL of them: every ' +
        'instance listed above will be stopped and deleted. Continue?';
      if MsgBox(Msg, mbConfirmation, MB_YESNO) = IDNO then
        Result := False;
    end;
  finally
    Names.Free;
  end;
end;

procedure CurUninstallStepChanged(RunStep: TUninstallStep);
var
  DirToDelete, SvcName: string;
  Names: TStringList;
  I: Integer;
begin
  if RunStep = usUninstall then
  begin
    Names := TStringList.Create;
    try
      LoadServiceManifest(Names);

      for I := 0 to Names.Count - 1 do
      begin
        SvcName := Trim(Names[I]);
        if Length(SvcName) = 0 then Continue;

        // 1. Stop Service
        ExecCmd('sc.exe', 'stop "' + SvcName + '"', '');
        Sleep(1000);

        // 2. Data Removal
        if MsgBox('Do you wish to remove all data for service "' + SvcName + '" (cache, logs...)?', mbInformation, MB_YESNO) = IDYES then
        begin
          // Look up data dir in the specific registry key for this service
          if RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Services\' + SvcName, 'DataDir', DirToDelete) then
          begin
            DeleteDataDir(DirToDelete);
            RemoveDir(DirToDelete);
          end;
        end;

        // 3. Delete Service
        ExecCmd('sc.exe', 'delete "' + SvcName + '"', '');
      end;
    finally
      Names.Free;
    end;
  end;
end;