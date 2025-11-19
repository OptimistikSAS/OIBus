; --- Dynamic Definitions ---

; 1. Handle Application Version
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-LOCAL"
#endif

; 2. Handle Code Signing
#ifdef MyCertFile
  #define EnableSigning
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
  SignTool=signtool /fd SHA256 /tr http://timestamp.comodoca.com /td SHA256 /n $q{#MyAppPublisher}$q /d $q{#MyAppName}$q /f $q{#MyCertFile}$q /p $q{#MyCertPassword}$q $f
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
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
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
WizardResizable=no
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

[Registry]
; We use the dynamic {code:GetServiceName} to create a unique registry key for this service instance
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Services\{code:GetServiceName}"; ValueType: string; ValueName: "DataDir"; ValueData: "{code:GetDataDir}"; Flags: uninsdeletevalue

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

  // Global variables to store user choices
  FinalServiceName: String;
  FinalDataDir: String;

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
  lblService, lblData: TNewStaticText;
  btnBrowse: TButton;
begin
  // Create the Custom Page
  ConfigPage := CreateCustomPage(wpSelectTasks, 'Service Configuration', 'Configure the Windows Service and Data Storage');

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
end;

// --- Validation & Overwrite Check ---

function NextButtonClick(CurPageID: Integer): Boolean;
var
  SettingsFile: string;
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

    if Length(FinalDataDir) = 0 then
    begin
      MsgBox('You must enter a Data Directory.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // 3. Overwrite Check
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
begin;
    FileContent := '@echo off' + #13#10
          + 'echo Stopping ' + FinalServiceName + ' service...' + #13#10
          + 'nssm.exe stop "' + FinalServiceName + '"' + #13#10
          + '"' + ExpandConstant('{app}') + '\oibus-launcher.exe" --config "' + FinalDataDir + '"' + #13#10
          + 'pause';
    Result := SaveStringToFile(ExpandConstant('{app}') + '\go.bat', FileContent, False);
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

     ExecCmd(ExpandConstant('{cmd}'), '/C "sc.exe stop "' + LegacySvcName + '" >nul 2>&1"', '');
     Sleep(1000);
  end;

  if CurStep = ssPostInstall then
  begin
    // Save the service name for the Uninstaller!
    SaveStringToFile(ExpandConstant('{app}\service.name'), FinalServiceName, False);

    if not CreateDataDir then
      MsgBox('ERROR : OIBus data directory Setup failed.', mbCriticalError, MB_OK)
    else begin
      if not CreateLauncherFile() then
        MsgBox('ERROR : Launcher file creation failed', mbCriticalError, MB_OK)
      else if not InstallProgram() then
        MsgBox('ERROR : Installation has failed', mbCriticalError, MB_OK);
    end;
  end;
end;

// --- Uninstallation Logic ---

procedure CurUninstallStepChanged(RunStep: TUninstallStep);
var
  DirToDelete, SvcName: string;
  ServiceNameFile: string;
  SvcNameAnsi: AnsiString;
begin
  if RunStep = usUninstall then
  begin
    // 1. Determine Service Name
    SvcName := 'OIBus'; // Fallback default

    ServiceNameFile := ExpandConstant('{app}\service.name');
    if FileExists(ServiceNameFile) then
    begin
      // Load into AnsiString buffer first
      if LoadStringFromFile(ServiceNameFile, SvcNameAnsi) then
      begin
         SvcName := String(SvcNameAnsi);
      end;
    end;

    // 2. Stop Service
    ExecCmd(ExpandConstant('{cmd}'), '/C "sc.exe stop "' + SvcName + '" >nul 2>&1"', '');
    Sleep(1000);

    // 3. Data Removal
    if MsgBox('Do you wish to remove all data for service "' + SvcName + '" (cache, logs...)?', mbInformation, MB_YESNO) = IDYES then
    begin
      // Look up data dir in the specific registry key for this service
      if RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Services\' + SvcName, 'DataDir', DirToDelete) then
      begin
        DeleteDataDir(DirToDelete);
        RemoveDir(DirToDelete);
      end;
    end;

    // 4. Delete Service
    ExecCmd(ExpandConstant('{cmd}'), '/C "sc.exe delete "' + SvcName + '" >nul 2>&1"', '');
  end;
end;