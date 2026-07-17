# KIS Native Desktop Architecture

## Decision

Build KIS desktop as **true native platform apps**.

- macOS: Swift + SwiftUI
- Windows: WinUI 3 + C#

The macOS shell is implemented and locally buildable on this machine. A parallel Windows-native scaffold is now added, but it must be opened and built on Windows because WinUI 3 and MSIX packaging require the Windows SDK / Visual Studio toolchain.

## Project Structure

```text
KIS_desktop/
├── docs/
│   ├── native-desktop-audit.md
│   └── native-desktop-architecture.md
├── native/
│   ├── macos/
│   │   └── KISDesktopMac/
│   │       ├── Package.swift
│   │       └── Sources/
│   │           └── KISDesktopApp/
│   │               ├── KISDesktopApp.swift
│   │               ├── AppModel.swift
│   │               ├── DesktopModels.swift
│   │               ├── KISTheme.swift
│   │               ├── DesktopAPI.swift
│   │               ├── RootShellView.swift
│   │               ├── LoginView.swift
│   │               ├── DashboardHomeView.swift
│   │               ├── BroadcastOverviewView.swift
│   │               ├── BroadcastDetailView.swift
│   │               └── EventDetailView.swift
│   └── windows/
│       └── KISDesktopWin/
│           ├── KISDesktopWin.sln
│           └── KISDesktopWin/
│               ├── KISDesktopWin.csproj
│               ├── App.xaml
│               ├── App.xaml.cs
│               ├── MainWindow.xaml
│               ├── MainWindow.xaml.cs
│               ├── Models/
│               ├── Services/
│               ├── ViewModels/
│               └── Theme/
```

## Design System Strategy

Shared by design only:
- palette derived from RN `KIS_COLORS`
- shell composition from large-screen mock
- card geometry and gold-accent treatment

Shared in code:
- none yet across RN and native UI
- backend contracts remain shared at the API level, not UI level

## Networking/Auth Strategy

- backend and GraphQL gateway remain source of truth
- desktop app owns only:
  - bearer token storage
  - device/client identification later
  - request composition
  - screen-shaped loading state
- no business-rule duplication in desktop

## State/Data Flow

- `AppModel` is the root observable object
- `DesktopRoute` owns high-level shell navigation
- detail screens bind to selected domain entities
- seed/mock data is used for this first native shell while API integration points are scaffolded

## Local Storage Strategy

Planned:
- Keychain for session/token
- `Application Support/KIS Desktop/` for cached JSON/media metadata
- URLCache / file-backed screen cache where defensible

## Why Swift Package First

A Swift package gives a clean native code boundary immediately and is lighter to create programmatically than hand-authoring a full `.xcodeproj` from scratch in one pass.

This is not a web wrapper and not a RN conversion. It is native SwiftUI code with a desktop-first shell.
