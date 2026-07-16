$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $workspaceRoot "docs\enterprise-edition"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$wdCollapseEnd = 0
$wdStory = 6
$wdPageBreak = 7
$wdSectionBreakNextPage = 2
$wdColorGray15 = 14277081
$wdColorGray25 = 12632256
$wdColorGray05 = 15921906
$wdColorWhite = 16777215
$wdBorderBottom = -3
$wdLineStyleSingle = 1
$wdLineWidth050pt = 4
$wdPreferredWidthPoints = 3
$wdRowHeightAuto = 0
$wdCellAlignVerticalCenter = 1
$wdAlignParagraphLeft = 0
$wdAlignParagraphCenter = 1

function Set-DocumentBaseStyle {
  param($Doc)
  $normal = $Doc.Styles.Item("Normal")
  $normal.Font.Name = "Calibri"
  $normal.Font.Size = 11
  $normal.ParagraphFormat.SpaceAfter = 6
  $normal.ParagraphFormat.LineSpacingRule = 0
  $normal.ParagraphFormat.LineSpacing = 14

  $h1 = $Doc.Styles.Item("Heading 1")
  $h1.Font.Name = "Calibri"
  $h1.Font.Size = 16
  $h1.Font.Bold = $true
  $h1.Font.Color = 7829367
  $h1.ParagraphFormat.SpaceBefore = 16
  $h1.ParagraphFormat.SpaceAfter = 8

  $h2 = $Doc.Styles.Item("Heading 2")
  $h2.Font.Name = "Calibri"
  $h2.Font.Size = 13
  $h2.Font.Bold = $true
  $h2.Font.Color = 7829367
  $h2.ParagraphFormat.SpaceBefore = 12
  $h2.ParagraphFormat.SpaceAfter = 6

  $h3 = $Doc.Styles.Item("Heading 3")
  $h3.Font.Name = "Calibri"
  $h3.Font.Size = 12
  $h3.Font.Bold = $true
  $h3.Font.Color = 5127455
  $h3.ParagraphFormat.SpaceBefore = 8
  $h3.ParagraphFormat.SpaceAfter = 4
}

function Add-Paragraph {
  param(
    $Doc,
    [string]$Text,
    [string]$Style = "Normal",
    [int]$Alignment = $wdAlignParagraphLeft,
    [switch]$Bold,
    [int]$Size = 0,
    [string]$Color = ""
  )

  $p = $Doc.Content.Paragraphs.Add()
  $p.Range.Text = $Text
  $p.Range.Style = $Style
  $p.Alignment = $Alignment
  if ($Bold) { $p.Range.Font.Bold = $true }
  if ($Size -gt 0) { $p.Range.Font.Size = $Size }
  if ($Color) { $p.Range.Font.Color = [int]("0x$Color") }
  $p.Range.InsertParagraphAfter() | Out-Null
  return $p
}

function Add-CoverPage {
  param($Doc, [string]$Title, [string]$Subtitle, [string]$VersionText)
  $p1 = Add-Paragraph -Doc $Doc -Text $Title -Style "Normal" -Alignment $wdAlignParagraphCenter -Bold -Size 24
  $p1.Range.Font.Name = "Calibri"
  $p2 = Add-Paragraph -Doc $Doc -Text $Subtitle -Style "Normal" -Alignment $wdAlignParagraphCenter -Size 15
  $p2.Range.Font.Italic = $true
  $p3 = Add-Paragraph -Doc $Doc -Text $VersionText -Style "Normal" -Alignment $wdAlignParagraphCenter -Size 12
  $p3.Range.Font.Bold = $true
  $Doc.Paragraphs.Add().Range.InsertBreak($wdPageBreak) | Out-Null
}

function Add-Bullets {
  param($Doc, [string[]]$Items)
  foreach ($item in $Items) {
    $p = $Doc.Content.Paragraphs.Add()
    $p.Range.Text = $item
    $p.Range.Style = "Normal"
    $p.Range.ListFormat.ApplyBulletDefault() | Out-Null
    $p.Range.InsertParagraphAfter() | Out-Null
  }
}

function Add-Numbered {
  param($Doc, [string[]]$Items)
  foreach ($item in $Items) {
    $p = $Doc.Content.Paragraphs.Add()
    $p.Range.Text = $item
    $p.Range.Style = "Normal"
    $p.Range.ListFormat.ApplyNumberDefault() | Out-Null
    $p.Range.InsertParagraphAfter() | Out-Null
  }
}

function Add-KeyValueTable {
  param(
    $Doc,
    [object[][]]$Rows,
    [string]$Title = ""
  )
  if ($Title) { Add-Paragraph -Doc $Doc -Text $Title -Style "Heading 3" | Out-Null }
  $range = $Doc.Content
  $range.Collapse($wdCollapseEnd)
  $table = $Doc.Tables.Add($range, $Rows.Count, 2)
  $table.Style = "Table Grid"
  $table.Rows.Alignment = 0
  $table.Borders.OutsideLineStyle = $wdLineStyleSingle
  $table.Borders.InsideLineStyle = $wdLineStyleSingle
  $table.Rows.HeightRule = $wdRowHeightAuto
  $table.Columns.Item(1).PreferredWidthType = $wdPreferredWidthPoints
  $table.Columns.Item(1).PreferredWidth = 135
  $table.Columns.Item(2).PreferredWidthType = $wdPreferredWidthPoints
  $table.Columns.Item(2).PreferredWidth = 330

  for ($i = 0; $i -lt $Rows.Count; $i++) {
    $table.Cell($i + 1, 1).Range.Text = [string]$Rows[$i][0]
    $table.Cell($i + 1, 2).Range.Text = [string]$Rows[$i][1]
    $table.Cell($i + 1, 1).Range.Font.Bold = $true
    $table.Cell($i + 1, 1).VerticalAlignment = $wdCellAlignVerticalCenter
    $table.Cell($i + 1, 2).VerticalAlignment = $wdCellAlignVerticalCenter
    $table.Cell($i + 1, 1).Shading.BackgroundPatternColor = $wdColorGray05
  }

  $Doc.Content.InsertParagraphAfter() | Out-Null
  $Doc.Content.Collapse($wdCollapseEnd)
}

function Add-MatrixTable {
  param($Doc)
  $range = $Doc.Content
  $range.Collapse($wdCollapseEnd)
  $table = $Doc.Tables.Add($range, 12, 7)
  $table.Style = "Table Grid"
  $headers = @("Standard", "ICC", "SGCA", "GCU", "ABTW", "Web / Print / Docs", "AI Assets")
  $rows = @(
    @("Canon", "Yes", "Yes", "Yes", "Yes", "All", "Yes"),
    @("Typography", "Yes", "Yes", "Yes", "Yes", "All", "Yes"),
    @("Layout", "Yes", "Yes", "Yes", "Yes", "All", "Yes"),
    @("Rendering", "Yes", "Yes", "Yes", "Yes", "All", "Yes"),
    @("Accessibility", "Yes", "Yes", "Yes", "Yes", "Web / Docs", "Conditional"),
    @("Book", "Yes", "Yes", "No", "Yes", "Print / Docs", "No"),
    @("Dashboard", "Yes", "Yes", "Yes", "No", "Web / UI", "Conditional"),
    @("KDP", "Yes", "Yes", "No", "Yes", "Print Export", "No"),
    @("Repository", "Yes", "Yes", "Yes", "Yes", "All", "Yes"),
    @("Git", "Yes", "Yes", "Yes", "Yes", "All", "Yes"),
    @("QA", "Yes", "Yes", "Yes", "Yes", "All", "Yes")
  )
  for ($c = 0; $c -lt $headers.Count; $c++) {
    $cell = $table.Cell(1, $c + 1)
    $cell.Range.Text = $headers[$c]
    $cell.Range.Font.Bold = $true
    $cell.Shading.BackgroundPatternColor = $wdColorGray15
  }
  for ($r = 0; $r -lt $rows.Count; $r++) {
    for ($c = 0; $c -lt $rows[$r].Count; $c++) {
      $cell = $table.Cell($r + 2, $c + 1)
      $cell.Range.Text = $rows[$r][$c]
      $cell.VerticalAlignment = $wdCellAlignVerticalCenter
    }
  }
  $Doc.Content.InsertParagraphAfter() | Out-Null
  $Doc.Content.Collapse($wdCollapseEnd)
}

function Add-SectionBreak {
  param($Doc)
  $Doc.Paragraphs.Add().Range.InsertBreak($wdPageBreak) | Out-Null
}

function Save-AsDocxAndPdf {
  param($Doc, [string]$BasePath)
  $docxPath = "$BasePath.docx"
  $pdfPath = "$BasePath.pdf"
  $Doc.SaveAs([ref]$docxPath, [ref]16)
  $Doc.ExportAsFixedFormat($pdfPath, 17)
  return @($docxPath, $pdfPath)
}

function Build-FullHandbook {
  param($WordApp)
  $doc = $WordApp.Documents.Add()
  Set-DocumentBaseStyle -Doc $doc
  Add-CoverPage -Doc $doc `
    -Title "ICC / SGCA / GCU / ABTW`nUNIVERSAL PRODUCTION DNA" `
    -Subtitle "Enterprise Edition`nCanon-Locked v1.0" `
    -VersionText "Master Handbook Build Baseline"

  Add-Paragraph -Doc $doc -Text "Front Matter" -Style "Heading 1" | Out-Null
  $frontMatter = @(
    @("FM-01 Cover Page", "Mandatory - identifies the canonical document title, edition, and authority."),
    @("FM-02 Canon Lock Declaration", "Mandatory - defines immutability of canon and override rules."),
    @("FM-03 Document Authority", "Mandatory - establishes ownership, approval power, and change route."),
    @("FM-04 Version History", "Mandatory - records editions, updates, and governance events."),
    @("FM-05 Scope", "Mandatory - clarifies enterprise applicability across ICC, SGCA, GCU, and ABTW."),
    @("FM-06 How to use this Handbook", "Reference - provides navigation and operational usage instructions."),
    @("FM-07 Universal Production Pipeline Overview", "Reference - shows lifecycle from concept to validated release."),
    @("FM-08 Standards Hierarchy", "Mandatory - shows Canon > Production > QA > Platform > Appendices."),
    @("FM-09 Matrix of Compliance", "Mandatory - maps standards to enterprise and platform domains."),
    @("FM-10 Table of Contents", "Reference - navigation layer for the handbook.")
  )
  Add-KeyValueTable -Doc $doc -Rows $frontMatter -Title "Front Matter Register"

  Add-Paragraph -Doc $doc -Text "Universal Production Pipeline Overview" -Style "Heading 2" | Out-Null
  Add-Numbered -Doc $doc -Items @(
    "Canon intent is defined and locked before production work starts.",
    "Production standards translate canon into repeatable output rules.",
    "Platform standards adapt the universal rules to book, dashboard, web, print, and AI output contexts.",
    "QA and release validation gate every deliverable before publication or repository acceptance."
  )

  Add-Paragraph -Doc $doc -Text "Standards Hierarchy" -Style "Heading 2" | Out-Null
  Add-Bullets -Doc $doc -Items @(
    "Canon standards are immutable without Founder approval.",
    "Production standards are mandatory operating rules derived from canon.",
    "QA standards validate production outputs against canon and platform requirements.",
    "Platform standards define constrained implementation differences.",
    "Appendices provide reference structures, extension guides, registries, and export profiles."
  )

  Add-Paragraph -Doc $doc -Text "Matrix of Compliance" -Style "Heading 2" | Out-Null
  Add-MatrixTable -Doc $doc

  $chapters = @(
    @{No=1; Title="Purpose"; Owner="Founder"; Status="Mandatory"; Summary="Defines why Universal Production DNA exists and what enterprise problem it solves."},
    @{No=2; Title="Scope"; Owner="Enterprise"; Status="Mandatory"; Summary="Defines the boundary of applicability across entities, platforms, and artifact classes."},
    @{No=3; Title="Document Architecture"; Owner="Enterprise"; Status="Mandatory"; Summary="Describes how the handbook is structured, referenced, and maintained as a canonical system."},
    @{No=4; Title="Standards Hierarchy"; Owner="Enterprise"; Status="Mandatory"; Summary="Defines the ranking order of Canon, Production, QA, Platform, and Appendices."},
    @{No=5; Title="Canon Lock Declaration"; Owner="Founder"; Status="Mandatory"; Summary="Formally locks canon rules, intent, naming, and structural integrity."},
    @{No=6; Title="Canon Governance"; Owner="Canon"; Status="Mandatory"; Summary="Defines approval channels, exception processes, and founder-only change boundaries."},
    @{No=7; Title="Production DNA"; Owner="Production"; Status="Mandatory"; Summary="Translates canon into a universal production operating model."},
    @{No=8; Title="Global Production Rules"; Owner="Production"; Status="Mandatory"; Summary="Defines universal rules for production quality, consistency, and execution."},
    @{No=9; Title="Rendering Bible"; Owner="Rendering"; Status="Mandatory"; Summary="Defines rendering accuracy, DPI, export quality, and image integrity standards."},
    @{No=10; Title="Typography Bible"; Owner="Typography"; Status="Mandatory"; Summary="Defines text sizing, hierarchy, spacing, legibility, and minimum pixel rules."},
    @{No=11; Title="Layout Bible"; Owner="Layout"; Status="Mandatory"; Summary="Defines page structures, orientation logic, grids, and content density rules."},
    @{No=12; Title="Colour Bible"; Owner="Visual"; Status="Conditional"; Summary="Defines colour governance, profile usage, contrast, and print-safe palettes."},
    @{No=13; Title="Illustration Rules"; Owner="Visual"; Status="Conditional"; Summary="Defines treatment of diagrams, icons, infographics, and illustrated assets."},
    @{No=14; Title="Print Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines print-ready rules for production documents and visual assets."},
    @{No=15; Title="Book Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines structural rules for books, manuals, and long-form publication."},
    @{No=16; Title="KDP Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines Amazon KDP-specific trim, bleed, export, and validation rules."},
    @{No=17; Title="Dashboard Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines UI, layout, and system behavior rules for dashboards."},
    @{No=18; Title="Web Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines web output, page structures, navigation, and responsive production behavior."},
    @{No=19; Title="UI Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines interface components, affordances, and interaction hierarchy."},
    @{No=20; Title="AI Rendering Standards"; Owner="Platform"; Status="Conditional"; Summary="Defines AI-assisted rendering, prompt discipline, and deterministic output checks."},
    @{No=21; Title="Repository Standards"; Owner="Platform"; Status="Mandatory"; Summary="Defines repository layout, documentation pairing, registry discipline, and storage rules."},
    @{No=22; Title="Git Standards"; Owner="Platform"; Status="Mandatory"; Summary="Defines branch discipline, commit rules, merge expectations, and auditability."},
    @{No=23; Title="Versioning Standards"; Owner="Platform"; Status="Mandatory"; Summary="Defines semantic and canon-aware version control across outputs."},
    @{No=24; Title="Visual QA Checklist"; Owner="QA"; Status="Mandatory"; Summary="Defines visual integrity checks before release."},
    @{No=25; Title="Production QA Checklist"; Owner="QA"; Status="Mandatory"; Summary="Defines production correctness, asset integrity, and standards conformance checks."},
    @{No=26; Title="Canon Validation"; Owner="QA"; Status="Mandatory"; Summary="Defines how artifacts are evaluated against canon-locked rules."},
    @{No=27; Title="Release Validation"; Owner="QA"; Status="Mandatory"; Summary="Defines pre-release sign-off and exit criteria."},
    @{No=28; Title="Platform Matrix"; Owner="Enterprise"; Status="Reference"; Summary="Summarizes platform applicability across enterprise domains."},
    @{No=29; Title="Platform-specific Overrides"; Owner="Enterprise"; Status="Conditional"; Summary="Defines bounded exceptions for ICC, SGCA, GCU, and ABTW."}
  )

  Add-SectionBreak -Doc $doc
  Add-Paragraph -Doc $doc -Text "Parts I–VII Handbook Core" -Style "Heading 1" | Out-Null
  foreach ($chapter in $chapters) {
    Add-Paragraph -Doc $doc -Text ("Chapter {0} — {1}" -f $chapter.No, $chapter.Title) -Style "Heading 2" | Out-Null
    Add-KeyValueTable -Doc $doc -Rows @(
      @("Owner", $chapter.Owner),
      @("Status", $chapter.Status),
      @("Purpose", $chapter.Summary),
      @("Update Model", ($(if ($chapter.Owner -eq "Founder" -or $chapter.Title -like "*Canon*") {"Founder Approval"} elseif ($chapter.Status -eq "Mandatory") {"Operational Update with controlled review"} else {"Operational Update"})))
    )
    Add-Bullets -Doc $doc -Items @(
      "Authority statement: this chapter inherits the enterprise hierarchy and cannot conflict with higher-order canon clauses.",
      "Implementation note: every platform or artifact type must map its local rule set back to this chapter.",
      "Validation note: QA and release checkpoints must reference this chapter where applicable."
    )
  }

  Add-SectionBreak -Doc $doc
  Add-Paragraph -Doc $doc -Text "Development Priority" -Style "Heading 1" | Out-Null
  Add-Numbered -Doc $doc -Items @(
    "Canon Lock Declaration",
    "Global Production Rules",
    "Typography Bible",
    "Layout Bible",
    "UI Standards",
    "Accessibility Standards",
    "Repository Standards",
    "Git Standards",
    "Versioning Standards",
    "Visual QA Checklist",
    "Production QA Checklist",
    "Rendering Bible",
    "KDP Standards",
    "Dashboard Standards",
    "AI Rendering Standards",
    "Platform-specific Standards",
    "Appendices"
  )

  Add-Paragraph -Doc $doc -Text "Appendices Register" -Style "Heading 1" | Out-Null
  Add-KeyValueTable -Doc $doc -Rows @(
    @("Appendix A", "Repository Structure"),
    @("Appendix B", "Extensions Guide"),
    @("Appendix C", "Folder Structure"),
    @("Appendix D", "Naming Convention"),
    @("Appendix E", "Asset Registry"),
    @("Appendix F", "Export Profiles"),
    @("Appendix G", "Print Profiles"),
    @("Appendix H", "Colour Profiles"),
    @("Appendix I", "Template DNA"),
    @("Appendix J", "Universal Checklists")
  )

  return Save-AsDocxAndPdf -Doc $doc -BasePath (Join-Path $outputDir "ICC_SGCA_GCU_ABTW_Universal_Production_DNA_Enterprise_Edition_v1.0")
}

function Build-ExpansionPack {
  param($WordApp)
  $doc = $WordApp.Documents.Add()
  Set-DocumentBaseStyle -Doc $doc
  Add-CoverPage -Doc $doc `
    -Title "ICC / SGCA / GCU / ABTW`nChapter Expansion Pack" `
    -Subtitle "Chapters 1–12`nEnterprise Edition Foundation Build" `
    -VersionText "Working Draft v1.0"

  Add-Paragraph -Doc $doc -Text "Usage of this Expansion Pack" -Style "Heading 1" | Out-Null
  Add-Bullets -Doc $doc -Items @(
    "This expansion pack is the stable drafting core for the first twelve chapters of Enterprise Edition.",
    "Each chapter uses a fixed internal structure: Purpose, Authority, Rules, Exceptions, Validation, Dependencies, and Referenced Standards.",
    "The language is written to be transplantable into the master handbook with minimal structural change."
  )

  $chapterDetails = @(
    @{
      Title = "Chapter 1 — Purpose";
      Owner = "Founder";
      Status = "Mandatory";
      Purpose = "Define why the Universal Production DNA standard exists and what enterprise-level failures it is designed to prevent.";
      Rules = @(
        "The handbook exists to unify production logic across ICC, SGCA, GCU, and ABTW.",
        "Any local standard that conflicts with this handbook must be treated as invalid until reconciled.",
        "Universal Production DNA must always prioritize continuity, repeatability, and canon protection over local convenience."
      );
      Validation = @(
        "Confirm that every future chapter traces back to a clear enterprise purpose.",
        "Reject any platform rule that cannot justify its existence against the universal purpose."
      )
    },
    @{
      Title = "Chapter 2 — Scope";
      Owner = "Enterprise";
      Status = "Mandatory";
      Purpose = "Define the scope boundary for the handbook across organizations, platforms, repositories, and artifact types.";
      Rules = @(
        "The standard applies to books, dashboards, websites, documentation, diagrams, repositories, AI assets, and print outputs where enterprise branding and canon governance apply.",
        "Scope includes creation, editing, rendering, QA, export, release, archiving, and validation.",
        "Scope exclusions must be explicit, versioned, and approved."
      );
      Validation = @(
        "Every platform-specific section must state whether it is universal, conditional, or reference-only.",
        "Every appendix must state whether it is normative or supporting."
      )
    },
    @{
      Title = "Chapter 3 — Document Architecture";
      Owner = "Enterprise";
      Status = "Mandatory";
      Purpose = "Define how the handbook is structured and how documents derived from it inherit authority.";
      Rules = @(
        "The handbook must be organized into Front Matter, Parts, Chapters, and Appendices with stable numbering.",
        "Every chapter must declare owner, status, and change model.",
        "Cross-references must preserve the hierarchy and never create circular authority."
      );
      Validation = @(
        "Check that each chapter can stand alone without breaking enterprise context.",
        "Check that every cross-reference points upward or sideways, never ambiguously downward."
      )
    },
    @{
      Title = "Chapter 4 — Standards Hierarchy";
      Owner = "Enterprise";
      Status = "Mandatory";
      Purpose = "Define the ranking system for all standards contained in Enterprise Edition.";
      Rules = @(
        "Canon outranks Production.",
        "Production outranks QA implementation detail.",
        "QA outranks platform convenience.",
        "Platform rules cannot override Canon or Production rules unless an explicit override clause exists."
      );
      Validation = @(
        "Any conflict must be resolved by moving upward in the hierarchy.",
        "All exception handling must cite the exact governing layer."
      )
    },
    @{
      Title = "Chapter 5 — Canon Lock Declaration";
      Owner = "Founder";
      Status = "Mandatory";
      Purpose = "Formally lock canon so that intent, names, structure, and declared truths cannot be mutated informally.";
      Rules = @(
        "Canon-locked sections require Founder approval for any semantic change.",
        "Operational edits may improve clarity but cannot alter meaning.",
        "Platform adaptation must express canon, not reinterpret it."
      );
      Validation = @(
        "Track every canon change as a governance event, not a routine update.",
        "Reject edits that shift meaning under the guise of formatting or optimization."
      )
    },
    @{
      Title = "Chapter 6 — Canon Governance";
      Owner = "Canon";
      Status = "Mandatory";
      Purpose = "Define who can propose, approve, reject, or ratify canon-level changes.";
      Rules = @(
        "Founder holds final approval for canon mutations.",
        "Canon stewards may prepare recommendations but cannot ratify canon shifts alone.",
        "Disputes between platform optimization and canon integrity resolve in favor of canon integrity."
      );
      Validation = @(
        "Every proposed canon change must show rationale, impact, dependent standards, and rollback implications.",
        "Governance records must be discoverable and versioned."
      )
    },
    @{
      Title = "Chapter 7 — Production DNA";
      Owner = "Production";
      Status = "Mandatory";
      Purpose = "Convert canon into a universal production operating model.";
      Rules = @(
        "Production DNA must be deterministic enough that two teams can produce equivalent output from the same source standard.",
        "Production decisions must be documented as reusable patterns, not isolated tricks.",
        "Rendering, typography, layout, QA, and export are coupled elements of one production system."
      );
      Validation = @(
        "Assess whether the same result can be reproduced on repeated runs.",
        "Reject undocumented production behaviors that cannot be audited."
      )
    },
    @{
      Title = "Chapter 8 — Global Production Rules";
      Owner = "Production";
      Status = "Mandatory";
      Purpose = "Define cross-platform production rules that apply everywhere unless constrained by explicit overrides.";
      Rules = @(
        "All production artifacts must preserve readability, consistency, and structured hierarchy.",
        "Portrait and landscape logic must be intentional and documented.",
        "Export settings must preserve fidelity rather than relying on consumer defaults."
      );
      Validation = @(
        "Check for hierarchy clarity, output coherence, and standards compliance before release.",
        "Check that file formats and export decisions map to the documented extension guide."
      )
    },
    @{
      Title = "Chapter 9 — Rendering Bible";
      Owner = "Rendering";
      Status = "Mandatory";
      Purpose = "Define rendering expectations for document, dashboard, print, and visual outputs.";
      Rules = @(
        "300 DPI is the minimum print-safe rendering baseline for raster print assets.",
        "4K-class fidelity is the baseline for high-resolution presentation and hero visuals where applicable.",
        "No rendering pipeline may silently downsample, crop, or distort without declared intent."
      );
      Validation = @(
        "Check output dimensions, DPI metadata, aspect ratio, and visual integrity.",
        "Run visual QA against representative export targets, not only authoring views."
      )
    },
    @{
      Title = "Chapter 10 — Typography Bible";
      Owner = "Typography";
      Status = "Mandatory";
      Purpose = "Define readable, consistent, and canon-safe typography across all enterprise outputs.";
      Rules = @(
        "Typography must preserve hierarchy, pacing, and legibility before decorative expression.",
        "Minimum type increments must respect the declared +3 px baseline where pixel-based systems are used.",
        "Text treatments that reduce accessibility or clarity are disallowed, even if visually attractive."
      );
      Validation = @(
        "Check heading ladders, size contrast, line spacing, and minimum readable scale.",
        "Check that typography remains consistent across web, print, docs, and dashboard outputs."
      )
    },
    @{
      Title = "Chapter 11 — Layout Bible";
      Owner = "Layout";
      Status = "Mandatory";
      Purpose = "Define structural layout discipline for pages, spreads, screens, and reusable templates.";
      Rules = @(
        "Layout must reveal hierarchy and intent at first scan.",
        "Whitespace is part of structure, not leftover area.",
        "Tables, diagrams, forms, and callouts must use stable spacing and alignment logic."
      );
      Validation = @(
        "Check density, rhythm, spacing, orientation, and break behavior.",
        "Check that layout patterns remain reusable rather than one-off exceptions."
      )
    },
    @{
      Title = "Chapter 12 — Colour Bible";
      Owner = "Visual";
      Status = "Conditional";
      Purpose = "Define colour usage, profile governance, and contrast handling across enterprise outputs.";
      Rules = @(
        "Colour must support meaning, hierarchy, and recognition before decoration.",
        "Every production route must declare the colour profile it assumes.",
        "Contrast failures are treated as production defects."
      );
      Validation = @(
        "Check profile correctness for print and digital outputs.",
        "Check that colour usage remains consistent with the brand and accessibility standards."
      )
    }
  )

  foreach ($chapter in $chapterDetails) {
    Add-SectionBreak -Doc $doc
    Add-Paragraph -Doc $doc -Text $chapter.Title -Style "Heading 1" | Out-Null
    Add-KeyValueTable -Doc $doc -Rows @(
      @("Owner", $chapter.Owner),
      @("Status", $chapter.Status),
      @("Change Model", $(if ($chapter.Owner -eq "Founder" -or $chapter.Title -like "*Canon*") {"Founder Approval"} else {"Operational Update with controlled review"})),
      @("Primary Function", $chapter.Purpose)
    )

    Add-Paragraph -Doc $doc -Text "Purpose" -Style "Heading 2" | Out-Null
    Add-Paragraph -Doc $doc -Text $chapter.Purpose -Style "Normal" | Out-Null

    Add-Paragraph -Doc $doc -Text "Authority" -Style "Heading 2" | Out-Null
    Add-Bullets -Doc $doc -Items @(
      "This chapter inherits all higher-order requirements from the enterprise hierarchy.",
      "No lower-order operational note may contradict the rules defined here.",
      "Any exception must be declared explicitly and logged in the governance chain."
    )

    Add-Paragraph -Doc $doc -Text "Rules" -Style "Heading 2" | Out-Null
    Add-Numbered -Doc $doc -Items $chapter.Rules

    Add-Paragraph -Doc $doc -Text "Exceptions" -Style "Heading 2" | Out-Null
    Add-Bullets -Doc $doc -Items @(
      "Exceptions are valid only when documented, bounded, and traceable to a platform-specific override or founder-approved deviation.",
      "Unrecorded practical shortcuts are not considered exceptions; they are considered violations."
    )

    Add-Paragraph -Doc $doc -Text "Validation" -Style "Heading 2" | Out-Null
    Add-Bullets -Doc $doc -Items $chapter.Validation

    Add-Paragraph -Doc $doc -Text "Dependencies" -Style "Heading 2" | Out-Null
    Add-Bullets -Doc $doc -Items @(
      "Dependencies must be mapped to surrounding chapters so implementation remains coherent.",
      "Where a dependency is unresolved, the chapter must be treated as provisionally incomplete rather than silently assumed."
    )

    Add-Paragraph -Doc $doc -Text "Referenced Standards" -Style "Heading 2" | Out-Null
    Add-Bullets -Doc $doc -Items @(
      "Universal Production DNA Enterprise Edition core structure",
      "Matrix of Compliance",
      "Change Model and Governance Register",
      "Associated QA and platform standards where applicable"
    )
  }

  return Save-AsDocxAndPdf -Doc $doc -BasePath (Join-Path $outputDir "ICC_SGCA_GCU_ABTW_Chapter_Expansion_Pack_Ch01-Ch12_v1.0")
}

$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $fullPaths = Build-FullHandbook -WordApp $word
  $packPaths = Build-ExpansionPack -WordApp $word

  [PSCustomObject]@{
    FullDocx = $fullPaths[0]
    FullPdf = $fullPaths[1]
    PackDocx = $packPaths[0]
    PackPdf = $packPaths[1]
  } | Format-List
}
finally {
  if ($word) {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
