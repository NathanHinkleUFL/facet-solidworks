#requires -Version 5
<#
  Generates the bundled .streamDeckProfile files — one per supported device — so a fresh install
  lays out the whole deck automatically instead of the user hand-placing keys:

    Facet.streamDeckProfile    MK.2 (5x3, 15 keys, DeviceType 0)
    FacetXL.streamDeckProfile  XL  (8x4, 32 keys, DeviceType 2)

  Each profile fills every key with the FacetKey action (XL bottom row included — those keys can
  be reassigned to personal/Bambu actions later). Output: <plugin>/<name>.streamDeckProfile (a
  zip of <uuid>.sdProfile/...), referenced from the manifest's Profiles[].

  Format: the legacy flat "Version 1.0" bundle that the app's ESDProfileOperationImportFromPlugin
  importer accepts (exactly what the bundled Elgato tutorial plugin ships). The V3 page-folder
  format is only used by the app's own first-run default profiles (a different import path).
  DeviceModel must match the connected device's model id, since the importer aborts with
  "no matching or required profiles found" otherwise. On import the app converts this legacy
  bundle into ProfilesV3 on disk. Profiles are offered for install when the plugin is installed —
  dev-link mode does NOT trigger the import prompt.
#>
param([string]$PluginDir = "$PSScriptRoot\..\com.swrobotics.facet.sdPlugin")
$ErrorActionPreference = "Stop"

function New-FacetProfile {
  param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [string] $DeviceModel,
    [Parameter(Mandatory)] [int]    $Cols,
    [Parameter(Mandatory)] [int]    $Rows,
    [Parameter(Mandatory)] [string] $ProfUuid
  )

  # One FacetKey action per key. Coordinates are "col,row" across the device's grid.
  $actions = [ordered]@{}
  foreach ($row in 0..($Rows - 1)) {
    foreach ($col in 0..($Cols - 1)) {
      $actions["$col,$row"] = [ordered]@{
        Name     = "Facet Key"
        Settings = @{}
        State    = 0
        States   = @([ordered]@{
            FFamily        = ""
            FSize          = "13"
            FStyle         = ""
            FUnderline     = "off"
            Image          = ""
            Title          = ""
            TitleAlignment = "bottom"
            TitleColor     = "#F2F5F8"
            TitleShow      = "on"
          })
        UUID     = "com.swrobotics.facet.key"
      }
    }
  }

  $manifest = [ordered]@{
    Actions              = $actions
    DeviceModel          = $DeviceModel
    InstalledByPluginUUID = "com.swrobotics.facet"
    Name                 = $Name
    PreconfiguredName    = $Name
    Version              = "1.0"
  }

  # Build the folder structure in a temp dir.
  $work = Join-Path $env:TEMP "facet-profile-$([guid]::NewGuid())"
  $prof = Join-Path $work "$ProfUuid.sdProfile"
  New-Item -ItemType Directory -Force -Path $prof | Out-Null

  $manifest | ConvertTo-Json -Depth 12 -Compress | Set-Content (Join-Path $prof "manifest.json") -Encoding UTF8

  # Zip the .sdProfile folder (at archive root) and name it .streamDeckProfile.
  $out = Join-Path $PluginDir "$Name.streamDeckProfile"
  if (Test-Path $out) { Remove-Item $out -Force }
  $zip = Join-Path $work "Facet.zip"
  Compress-Archive -Path $prof -DestinationPath $zip -Force
  Move-Item $zip $out -Force
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue

  Write-Host "Wrote $out (Model $DeviceModel, ${Cols}x${Rows})"
}

New-FacetProfile -Name "Facet"   -DeviceModel "20GAA9901" -Cols 5 -Rows 3 `
  -ProfUuid "FACE7000-0000-4000-8000-000000000001"
New-FacetProfile -Name "FacetXL" -DeviceModel "20GAT9901" -Cols 8 -Rows 4 `
  -ProfUuid "FACE7100-0000-4000-8000-000000000001"