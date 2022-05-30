#define MyAppName "OIBus"
#define MyAppPublisher "OPTIMISTIK SAS"
#define MyAppURL "https://optimistik.io/oibus/"
#define MyDateTime GetDateTimeString('yyyy/mm/dd hh:nn:ss', '-', ':')

[Setup]
AppId={{A4DCC920-510F-4D9D-AD02-67AA402EC010}
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
LicenseFile=..\..\LICENSE
OutputDir=..\..\dist\win-setup-release
OutputBaseFilename=oibus_setup
PrivilegesRequired=admin
SolidCompression=yes
UsePreviousAppDir=no
UserInfoPage=no
SetupIconFile=oibus_icon.ico
WizardImageFile=oibus_icon.bmp
WizardSmallImageFile=oibus_icon_small.bmp
WizardStyle=modern
WizardSizePercent=100
WizardResizable=no


[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"


[Files]
Source: "..\..\dist\win\oibus.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "HdaAgent\*"; DestDir: "{app}\HdaAgent"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "OPC REDISTRIBUTABLES Agreement of Use.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\src\config\defaultConfig.json"; DestDir: "{app}"; Flags: ignoreversion


[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nIt is recommended that you close all other applications before continuing.%n%n%nIMPORTANT :%nInternet Explorer is NOT supported. OIBus can only be configured using an up-to-date browser, like Google Chrome, Mozilla Firefox or Microsoft Edge.


[Code]
var
  AccessLink: TLabel;
  OIBusLink: TLabel;
  MyAdminName: string;
  MyOIBusName: string;
  MyPortNum: string;
  OverwriteConfig: boolean;
  ConfExists: boolean;
  License2Accepted: TRadioButton;
  License2NotAccepted: TRadioButton;
  SecondLicensePage: TOutputMsgMemoWizardPage;
  OIBus_DataDirPage: TInputDirWizardPage;
  NamesQueryPage: TInputQueryWizardPage;
  AfterID: Integer;

// Delete OIBusData folder
function DeleteDataDir(DirToDelete: string): Boolean;
var
  CacheFolder: string;
  LogsFolder: string;
  JsonFile: string;
begin
    CacheFolder := DirToDelete + '\cache\'
    LogsFolder := DirToDelete + '\logs\'
    JsonFile := DirToDelete + '\oibus*.json'
    if not DelTree(CacheFolder, True, True, True) then
    begin
      MsgBox('Error: Directory ' + CacheFolder + ' could not be removed', mbError, MB_OK)
      Result := False
    end
    else if not DelTree(LogsFolder, True, True, True) then
    begin
      MsgBox('Error: Directory ' + LogsFolder + ' could not be removed', mbError, MB_OK)
      Result := False
    end
    else if not DelTree(JsonFile, False, True, False) then
    begin
      MsgBox('Error: File ' + JsonFile + ' could not be removed', mbError, MB_OK)
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
    if OverwriteConfig = True then
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
  else if not SaveStringToFile(LogPath, 'nssm.exe install OIBus "' + ExpandConstant('{app}') + '\oibus.exe" "--config ""' + OIBus_DataDirPage.Values[0] + '\oibus.json"""' + #13#10, True) then
    Result := False
  else  if not ExecCmd('nssm.exe', 'install OIBus "' + ExpandConstant('{app}') + '\oibus.exe" "--config ""' + OIBus_DataDirPage.Values[0] + '\oibus.json"""', ExpandConstant('{app}')) then
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

// Replace a string in a file with another ==> cf. SetConfig
function ReplaceEntry(FileContent, OldStr, NewStr: string): Boolean;
begin
  if StringChangeEx(FileContent, OldStr, NewStr, True) <= 0 then
    Result := False
  else
  begin
    MsgBox('.json-File Modif :' + #13#10 + FileContent, mbInformation, MB_OK)
    Result := True;
  end;
end;

// Generate go.bat file used to run OIBus from a terminal window
function CreateLauncherFile: Boolean;
var
  FileContent: ansistring;
  ConfigFilePath: string;
begin;
    ConfigFilePath := OIBus_DataDirPage.Values[0] + '\oibus.json';
    FileContent := 'echo Stopping OIBus service...' + #13#10
      + 'nssm.exe stop OIBus' + #13#10
      + '@echo Starting OIBus in the console...' + #13#10
      + '"' + ExpandConstant('{app}') + '\oibus.exe" --config "' + ConfigFilePath + '"'
    if not SaveStringToFile(ExpandConstant('{app}') + '\go.bat', FileContent, False) then
      Result := False
    else
      Result := True
end;

// Set configuration by altering oibus.json according to user input
function SetConfig: Boolean;
var
  DefaultConfigFilePath: string;
  ConfigFilePath: string;
  FileContent: ansistring;
  FileStr: string;
begin;
  DefaultConfigFilePath := ExpandConstant('{app}') + '\defaultConfig.json';
  ConfigFilePath := OIBus_DataDirPage.Values[0] + '\oibus.json';
  if ((ConfExists and OverwriteConfig) or not ConfExists) then
  begin
    MyOIBusName := NamesQueryPage.Values[0];
    MyAdminName := NamesQueryPage.Values[1];
    MyPortNum := NamesQueryPage.Values[2]
    // saving oibus.json content to a string and modifying values according to user-input
    if not LoadStringFromFile(DefaultConfigFilePath, FileContent) then
      Result := False
    else
    begin
      FileStr := FileContent;
      if StringChangeEx(FileStr, '"user": "admin"', '"user": "' + MyAdminName + '"', True) <= 0 then
        Result := True
      else if StringChangeEx(FileStr, '"engineName": "OIBus"', '"engineName": "' + MyOIBusName + '"', True) <= 0 then
        Result := True
      else if StringChangeEx(FileStr, '"level": "debug"', '"level": "error"', True) <= 0 then // Replace the debug level in error level for console log
        Result := True
      else if StringChangeEx(FileStr, '"level": "error",', '"level": "info",', True) <= 0 then // Replace the error level in info level for file and sqlite log
        Result := True
      // modifications applied : replacing old oibus.json content with new one
      else
      begin
        FileContent := FileStr;
        if DeleteFile(DefaultConfigFilePath) then
        begin
          if not SaveStringToFile(ConfigFilePath, FileContent, False) then
            Result := False
          else
            Result := True
        end
        else
          Result := False;
      end;
    end;
  end
  else
  begin
    // The default config file won't be use if another config file is used. It can be deleted
    DeleteFile(DefaultConfigFilePath)
    Result := True;
  end
end;

// Checking user-input
function NextButtonClick(CurPageID: Integer): Boolean;
var
  JsonFile: string;
begin
  Result := True;
  JsonFile := OIBus_DataDirPage.Values[0] + '\oibus.json';
  if (CurPageID = OIBus_DataDirPage.ID) then
  begin
    if FileExists(JsonFile) then
    begin
      ConfExists := True;
      if MsgBox('An oibus.json file was found at ' + OIBus_DataDirPage.Values[0] + '. Do you want to use it for this OIBus?', mbInformation, MB_YESNO) = IDNO then
      begin
        if MsgBox('WARNING : Overwriting the current setup will delete all logins, passwords and data you saved so far.' + #13#10 + 'Are you sure you want to proceed?', mbInformation, MB_YESNO) = IDNO then
          OverwriteConfig := False;
      end
      else
        OverwriteConfig := False;
    end;
  end;
  if CurPageId = NamesQueryPage.ID then
  begin
    if (StrToIntDef(NamesQueryPage.Values[2], -1) < 0) or (StrToIntDef(NamesQueryPage.Values[2], -1) > 65000) then
    begin
      MsgBox('Invalid value : the specified port must be a number between 0 and 65000.', mbError, MB_OK)
      Result := False
    end;
  end;
end;

// Update the 'Ready to install page with additional info'
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  Memo: String;
begin
  MyOIBusName := NamesQueryPage.Values[0];
  MyAdminName := NamesQueryPage.Values[1];
  MyPortNum := NamesQueryPage.Values[2];
  Memo := 'Destination location:' + Newline + Space + ExpandConstant('{app}') + Newline + Newline
  Memo := Memo + 'OIBus data folder location:' + Newline + Space + OIBus_DataDirPage.Values[0] + Newline + Newline
  if OverwriteConfig = True then
  begin
    Memo := Memo + 'OIBus name:' + Newline + Space + MyOIBusName + Newline + Newline
    Memo := Memo + 'Username:' + Newline + Space + MyAdminName + Newline + Newline
    Memo := Memo + 'OIBus port:' + Newline + Space + MyPortNum + Newline
  end;
  Result := Memo;
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

// Web-link on finish page to access OIBus directly
procedure OIBusLinkClick(Sender: TObject);
var
  ErrorCode: Integer;
  Link: string;
begin
  Link := 'http://localhost:'+ MyPortNum + '/';
  ShellExec('', Link, '', '', SW_SHOW, ewNoWait, ErrorCode);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = NamesQueryPage.ID) then
  begin
    if OverwriteConfig = False then
      Result := True;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    AccessLink.Visible := False;
    OIBusLink.Visible := False;
    OIBusLink.Caption := 'http://localhost:' + MyPortNum;
    if not ConfExists or (ConfExists and OverwriteConfig) then
    begin
      AccessLink.Visible := True;
      OIBusLink.Visible := True;
    end
  end;
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
        if not ExecCmd('nssm.exe', 'remove OIBus confirm', ExpandConstant('{app}')) then
        begin
          MsgBox('ERROR : Could not remove OIBus service. Remove it manually and retry installation.', mbCriticalError, MB_OK)
        end
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
      // 3# Altering oibus.json according to user-input
      else if not SetConfig() then
      begin
        MsgBox('ERROR : Configuration-setup failed', mbCriticalError, MB_OK);
        DeleteMyRegistry
      end
      // 4# creating go.bat file
      else if not CreateLauncherFile() then
      begin
        MsgBox('ERROR : Launcher file creation failed', mbCriticalError, MB_OK);
        DeleteMyRegistry
      end
      // 5# executing install related commands
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
  OverwriteConfig := True;
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
  OIBus_DataDirPage := CreateInputDirPage(AfterID, 'Select OIBus data-directory', 'Where do you want to save your OIBus-related data (cache, logs...) ?', 'oibus.json and all OIBus related data will be saved in the following folder.', False, 'OIBusData');
  OIBus_DataDirPage.Add('&To continue, click Next. If you would like to select a different folder, click Browse.');
  OIBus_DataDirPage.Values[0] := 'C:\OIBusData\';
  AfterID := OIBus_DataDirPage.ID;
  // Page for user input: username, OIBus-name and port
  NamesQueryPage := CreateInputQueryPage(AfterID, 'Information', 'Various identification-related information', '');
	NamesQueryPage.Add('Enter a name for your OIBus client. It will be used as unique identifier for your OIBus.', False);
  NamesQueryPage.Values[0] := 'OIBus';
  NamesQueryPage.Add('Enter a username. It will be used to log into the OIBus portal.', False);
  NamesQueryPage.Values[1] := 'admin';
  NamesQueryPage.Add('Enter the port on which you want your OIBus-client to run.', False);
  NamesQueryPage.Values[2] := '2223';
  AfterID := NamesQueryPage.ID;
  MyOIBusName := NamesQueryPage.Values[0];
  MyAdminName := NamesQueryPage.Values[1];
  MyPortNum := NamesQueryPage.Values[2];
  // Link to access OIBus interface after Install
  AccessLink := TLabel.Create(WizardForm);
  AccessLink.Parent := WizardForm.FinishedPage;
  AccessLink.Left := 210;
  AccessLink.Top := 300;
  AccessLink.Caption := 'Access OIBus :';
  OIBusLink := TLabel.Create(WizardForm);
  OIBusLink.Parent := WizardForm.FinishedPage;
  OIBusLink.Left := 300;
  OIBusLink.Top := 300; //WizardForm.ClientHeight - OIBusLink.ClientHeight + 8;
  OIBusLink.Cursor := crHand;
  OIBusLink.Font.Color := clBlue;
  OIBusLink.Font.Style := [fsUnderline];
  OIBusLink.OnClick := @OIBusLinkClick;
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
      if MsgBox('Do you wish to remove all OIBus data (cache, logs...) ? All data, credentials and logs about your current OIBus will be permanently erased.', mbInformation, MB_YESNO) = IDYES then
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
Name: {app}\install.log; Type: files
Name: {app}\go.bat; Type: files
Name: {app}; Type: dirifempty
