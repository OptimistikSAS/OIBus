#define MyAppName "OIBus"
#define MyAppPublisher "Optimistik SAS"
#define MyAppURL "https://optimistik.io/oibus/"
#define MyDateTime GetDateTimeString('yyyy/mm/dd hh:nn:ss', '-', ':')

[Setup]
SignedUninstaller=yes
SignTool=signtool /fd SHA256 /tr http://timestamp.comodoca.com /td SHA256 /n $q{#MyAppPublisher}$q /d $q{#MyAppName}$q /f $q{#MyCertFile}$q /p $q{#MyCertPassword}$q $f
AppId=A4DCC920-510F-4D9D-AD02-67AA402EC010
AppName={#MyAppName}
// MyAppVersion is set by the npm command build-win-setup on release
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL=https://github.com/OptimistikSAS/OIBus
AppUpdatesURL={#MyAppURL}
AppCopyright=Copyright 2019-2022 Optimistik, all rights reserved
ArchitecturesAllowed=x64
Compression=lzma
DefaultDirName=C:\Program Files\{#MyAppName}
DirExistsWarning=yes
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
LicenseFile=..\..\..\LICENSE
OutputDir=..\..\bin\win-setup-release
OutputBaseFilename=oibus-setup
PrivilegesRequired=admin
SolidCompression=yes
UsePreviousAppDir=no
UserInfoPage=no
SetupIconFile=..\..\..\frontend\src\favicon.ico
WizardImageFile=installer_oibus.bmp
WizardSmallImageFile=installer_small.bmp
WizardStyle=modern
WizardSizePercent=100
WizardResizable=no


[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"


[Files]
Source: "..\..\bin\win\oibus.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\bin\win\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\bin\win\LICENSE"; DestDir: "{app}"; Flags: ignoreversion


[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%n%nIMPORTANT:%nInternet Explorer is NOT supported. OIBus can only be configured using an up-to-date browser, like Google Chrome, Mozilla Firefox or Microsoft Edge.


[Code]
var
  OverwriteConfig: boolean;
  ConfExists: boolean;
  License2Accepted: TRadioButton;
  License2NotAccepted: TRadioButton;
  SecondLicensePage: TOutputMsgMemoWizardPage;
  OIBus_DataDirPage: TInputDirWizardPage;
  AfterID: Integer;

// Delete OIBusData folder
function DeleteDataDir(DirToDelete: string): Boolean;
var
  CacheFolder: string;
  LogsFolder: string;
  CertsFolder: string;
  SettingsFile: string;
  CryptoFile: string;
begin
    CacheFolder := DirToDelete + '\cache\'
    LogsFolder := DirToDelete + '\logs\'
    CertsFolder := DirToDelete + '\certs\'
    SettingsFile := DirToDelete + '\oibus.db'
    CryptoFile := DirToDelete + '\crypto.db'
    if (DirExists(CacheFolder) and not DelTree(CacheFolder, True, True, True)) then
    begin
      MsgBox('Error: Directory ' + CacheFolder + ' could not be removed', mbError, MB_OK)
      Result := False
    end
    else if (DirExists(LogsFolder) and not DelTree(LogsFolder, True, True, True)) then
    begin
      MsgBox('Error: Directory ' + LogsFolder + ' could not be removed', mbError, MB_OK)
      Result := False
    end
    else if (DirExists(CertsFolder) and not DelTree(CertsFolder, True, True, True)) then
    begin
      MsgBox('Error: Directory ' + CertsFolder + ' could not be removed', mbError, MB_OK)
      Result := False
    end
    else if not DelTree(SettingsFile, False, True, False) then
    begin
      MsgBox('Error: File ' + SettingsFile + ' could not be removed', mbError, MB_OK)
      Result := False
    end
    else if not DelTree(CryptoFile, False, True, False) then
        begin
          MsgBox('Error: File ' + CryptoFile + ' could not be removed', mbError, MB_OK)
          Result := False
        end
    else
    begin
      Sleep(400)
      Result := True
    end
end;

// Delete custom-made registry-entries
function DeleteMyRegistry: Boolean;
begin
  if RegValueExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\OIBus', 'DataDir') then
  begin
    if not RegDeleteValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\OIBus', 'DataDir') then
      Result := False
    else
      Result := True
  end
  else
    Result := True
end;

// Create (or overwrite existing) OIBus_Data directory
function CreateDataDir: Boolean;
var
  DirCreated: Boolean;
begin
  Result := True;
  if not DirExists(OIBus_DataDirPage.Values[0]) then
  begin
    DirCreated := CreateDir(OIBus_DataDirPage.Values[0])
    if not DirCreated then
    begin
      MsgBox('Error: Directory ' + OIBus_DataDirPage.Values[0] + ' could not be created', mbError, MB_OK)
      Result := False;
    end
  end
  else
  begin
    if (OverwriteConfig and DirExists(OIBus_DataDirPage.Values[0])) then
    begin
      if not DeleteDataDir(OIBus_DataDirPage.Values[0]) then
        Result := False
    end;
  end;
end;

// Execute commands with parameters (and eventual redirection of return-value) ==> cf. InstallProgram
function ExecCmd(Prog: string; Params: string; WorkingDir: string): Boolean;
var
  ResultCode: Integer;
  ExecReturn: Boolean;
begin
  ExecReturn := ShellExec('', Prog, Params, WorkingDir, SW_HIDE, ewWaitUntilTerminated, ResultCode)
  if ExecReturn then
    Result := True
  else
  begin
    MsgBox('ERROR: Failed to execute :' + Prog + Params, mbError, MB_OK)
    MsgBox('Error-message : ' + SysErrorMessage(ResultCode), mbError, MB_OK)
    Result := False;
  end;
end;

// Service installation
function InstallProgram(): Boolean;
var
  LogPath: string;
begin
  LogPath := ExpandConstant('{app}') + '\install.log';
  if not SaveStringToFile(LogPath, '{#MyDateTime}' + #13#10, True) then
    Result := False
  else if not SaveStringToFile(LogPath, 'nssm.exe stop OIBus >nul 2>&1 "' + ExpandConstant('{app}') + '"' + #13#10, True) then
    Result := False
  else if not ExecCmd('nssm.exe', 'stop OIBus >nul 2>&1', ExpandConstant('{app}')) then
    Result := False
  else if not SaveStringToFile(LogPath, 'nssm.exe install OIBus "' + ExpandConstant('{app}') + '\oibus.exe" "--config ""' + OIBus_DataDirPage.Values[0] + '"""' + #13#10, True) then
    Result := False
  else  if not ExecCmd('nssm.exe', 'install OIBus "' + ExpandConstant('{app}') + '\oibus.exe" "--config ""' + OIBus_DataDirPage.Values[0] + '"""', ExpandConstant('{app}')) then
    Result := False
  else if not SaveStringToFile(LogPath, 'nssm.exe set OIBus AppDirectory "' + ExpandConstant('{app}') + '"' + #13#10, True) then
    Result := False
  else if not ExecCmd('nssm.exe', 'set OIBus AppDirectory "' + ExpandConstant('{app}') + '"', ExpandConstant('{app}')) then
    Result := False
  else if not SaveStringToFile(LogPath, 'nssm set OIBus AppNoConsole 1' + #13#10, True) then
    Result := False
  else if not ExecCmd('nssm', 'set OIBus AppNoConsole 1', ExpandConstant('{app}')) then
    Result := False
  else if not SaveStringToFile(LogPath, 'nssm.exe start OIBus "' + ExpandConstant('{app}') + '"' + #13#10, True) then
    Result := False
  else if not ExecCmd('nssm.exe', 'start OIBus', ExpandConstant('{app}')) then
    Result := False
  else
    Result := True;
end;

// Generate go.bat file used to run OIBus from a terminal window
function CreateLauncherFile: Boolean;
var
  FileContent: ansistring;
  ConfigFilePath: string;
begin;
    ConfigFilePath := OIBus_DataDirPage.Values[0];
    FileContent := 'echo Stopping OIBus service... You can restart it from the Windows Service Manager' + #13#10
      + 'nssm.exe stop OIBus' + #13#10
      + '"' + ExpandConstant('{app}') + '\oibus.exe" --config "' + ConfigFilePath + '"'
    if not SaveStringToFile(ExpandConstant('{app}') + '\go.bat', FileContent, False) then
      Result := False
    else
      Result := True
end;

// Checking user-input
function NextButtonClick(CurPageID: Integer): Boolean;
var
  SettingsFile: string;
begin
  Result := True;
  SettingsFile := OIBus_DataDirPage.Values[0] + '\oibus.db';
  if (CurPageID = OIBus_DataDirPage.ID) then
  begin
    if FileExists(SettingsFile) then
    begin
      ConfExists := True;
      if MsgBox('An configuration file was found at ' + OIBus_DataDirPage.Values[0] + '. Do you want to use it?', mbInformation, MB_YESNO) = IDNO then
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

function UninstallProgram(): Boolean;
begin
  if not ExecCmd('nssm.exe', 'remove OIBus confirm', ExpandConstant('{app}')) then
  begin
    MsgBox('ERROR : OIBus service uninstall failed. Remove it manually.', mbCriticalError, MB_OK)
    Result := False
  end
  else
  begin
    Result := True
    Sleep(400)
  end
end;

function StopProgram(): Boolean;
begin
  if not ExecCmd('nssm.exe', ' stop OIBus', ExpandConstant('{app}')) then
    Result := False
  else
    begin
      Result := True
      Sleep(400)
    end
end;

// License-related functions
procedure CheckLicense2Accepted;
begin
  WizardForm.NextButton.Enabled := License2Accepted.Checked;
end;

procedure License2NextButton(Sender: TObject);
begin
  CheckLicense2Accepted;
end;

procedure License2Active(Sender: TWizardPage);
begin
  CheckLicense2Accepted;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Dir: string;
begin
  if CurStep = ssInstall then
  begin
      if RegValueExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\OIBus', 'ImagePath') then
      begin
        if RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\OIBus', 'ImagePath', Dir) then
        begin
          ExecCmd('nssm.exe', ' stop OIBus', Dir + '\..\')
          Sleep(400);
        end;
      end;
  end;
  if CurStep = ssPostInstall then
  begin
    // 1# Creating/overwriting OIBusData
    if not CreateDataDir then
      MsgBox('ERROR : OIBus data directory Setup failed when creating data directory.', mbCriticalError, MB_OK)
    else begin
      // 2# Saving OIBusData folder-path to registry for later use
      if not RegWriteStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\OIBus', 'DataDir', OIBus_DataDirPage.Values[0]) then
      begin
        MsgBox('ERROR : could not write in registry ; Setup failed.', mbError, MB_OK)
        DeleteMyRegistry
      end
      // 3# creating go.bat file
      else if not CreateLauncherFile() then
      begin
        MsgBox('ERROR : Launcher file creation failed', mbCriticalError, MB_OK);
        DeleteMyRegistry
      end
      // 4# executing install related commands
      else if not InstallProgram() then
      begin
        MsgBox('ERROR : Installation has failed', mbCriticalError, MB_OK)
        DeleteMyRegistry;
      end;
    end;
  end;
end;

function InitializeSetup: Boolean;
begin
  OverwriteConfig := False;
  ConfExists := False;
  Result := True;
end;

procedure InitializeWizard();
var
  LicenseFilePath: string;
begin
  AfterID := wpSelectTasks;
  // Create second license page, with the same labels as the original license page
  SecondLicensePage := CreateOutputMsgMemoPage(wpLicense, SetupMessage(msgWizardLicense),
                        SetupMessage(msgLicenseLabel), SetupMessage(msgLicenseLabel3), '');
  // Load license
  ExtractTemporaryFile('OPC REDISTRIBUTABLES Agreement of Use.md');
  LicenseFilePath := ExpandConstant('{tmp}\' + 'OPC REDISTRIBUTABLES Agreement of Use.md');
  SecondLicensePage.RichEditViewer.Lines.LoadFromFile(LicenseFilePath);
  SecondLicensePage.RichEditViewer.Height := WizardForm.LicenseMemo.Height;
  SecondLicensePage.OnActivate := @License2Active;
  License2Accepted := TRadioButton.Create(WizardForm);
  License2Accepted.Top := WizardForm.LicenseAcceptedRadio.Top;
  License2Accepted.Width := WizardForm.LicenseAcceptedRadio.Width;
  License2Accepted.Parent := SecondLicensePage.Surface;
  License2Accepted.Caption := SetupMessage(msgLicenseAccepted);
  License2NotAccepted := TRadioButton.Create(WizardForm);
  License2NotAccepted.Top := WizardForm.LicenseNotAcceptedRadio.Top;
  License2NotAccepted.Width := WizardForm.LicenseNotAcceptedRadio.Width;
  License2NotAccepted.Parent := SecondLicensePage.Surface;
  License2NotAccepted.Caption := SetupMessage(msgLicenseNotAccepted);
  License2NotAccepted.Checked := True;
  License2NotAccepted.OnClick := @License2NextButton;
  License2Accepted.OnClick := @License2NextButton;
  // Page for user input : OIBus_Data folder-path
  OIBus_DataDirPage := CreateInputDirPage(AfterID, 'Select OIBus data-directory', 'Where do you want to save your OIBus-related data (configuration, cache, logs...) ?', '', False, 'OIBusData');
  OIBus_DataDirPage.Add('&To continue, click Next. If you would like to select a different folder, click Browse.');
  OIBus_DataDirPage.Values[0] := 'C:\OIBusData\';
  AfterID := OIBus_DataDirPage.ID;
end;

procedure CurUninstallStepChanged(RunStep: TUninstallStep);
var
  DirToDelete: string;
begin
  if RunStep = usUninstall then
  begin
    if not StopProgram() then
      MsgBox('ERROR : OIBus could not be stop', mbCriticalError, MB_OK)
    else
    begin
      if MsgBox('Do you wish to remove all OIBus data (cache, logs...)? All data, credentials and logs about your current OIBus will be permanently erased.', mbInformation, MB_YESNO) = IDYES then
      begin
        if RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\OIBus', 'DataDir', DirToDelete) then
        begin
          DeleteDataDir(DirToDelete)
          RemoveDir(DirToDelete)
        end
        else
          MsgBox('ERROR : Could not read OIBus DataDir registry', mbCriticalError, MB_OK);
        UninstallProgram()
      end
      else
        UninstallProgram()
    end
  end
end;


[UninstallDelete]
Name: {app}\oibus.exe; Type: files
Name: {app}\nssm.exe; Type: files
Name: {app}\LICENSE; Type: files
Name: {app}\install.log; Type: files
Name: {app}\go.bat; Type: files
Name: {app}; Type: dirifempty
