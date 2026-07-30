Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$socialDir = Join-Path $root "public\social"
New-Item -ItemType Directory -Path $socialDir -Force | Out-Null

function Get-FrontmatterValue {
	param(
		[string]$Text,
		[string]$Key
	)

	$quoted = [regex]::Match($Text, "(?m)^$([regex]::Escape($Key)):\s*`"(.*?)`"\s*$")
	if ($quoted.Success) { return $quoted.Groups[1].Value.Trim() }

	$plain = [regex]::Match($Text, "(?m)^$([regex]::Escape($Key)):\s*(.+?)\s*$")
	if ($plain.Success) { return $plain.Groups[1].Value.Trim() }

	return ""
}

function Get-FrontmatterListFirst {
	param(
		[string]$Text,
		[string]$Key
	)

	$block = [regex]::Match($Text, "(?m)^$([regex]::Escape($Key)):\s*\r?\n\s*-\s*(.+?)\s*$")
	if ($block.Success) { return $block.Groups[1].Value.Trim().Trim('"') }

	return ""
}

function Get-SocialImagePath {
	param([string]$Text)

	$match = [regex]::Match($Text, '(?m)^images:\s*\[\s*"([^"]+)"\s*\]\s*$')
	if (-not $match.Success) { return "" }

	return $match.Groups[1].Value.Trim()
}

function New-Color {
	param([string]$Hex)
	return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-FittedFont {
	param(
		[System.Drawing.Graphics]$Graphics,
		[string]$Text,
		[string]$Family,
		[float]$MaximumSize,
		[float]$MinimumSize,
		[float]$Width,
		[float]$Height,
		[System.Drawing.StringFormat]$Format
	)

	for ($size = $MaximumSize; $size -ge $MinimumSize; $size -= 2) {
		$font = [System.Drawing.Font]::new($Family, $size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
		$measurement = $Graphics.MeasureString($Text, $font, [int]$Width, $Format)
		if ($measurement.Height -le $Height) { return $font }
		$font.Dispose()
	}

	return [System.Drawing.Font]::new($Family, $MinimumSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-SocialCard {
	param(
		[string]$Title,
		[string]$Description,
		[string]$TopRight,
		[string]$BottomLeft,
		[string]$OutputPath,
		[bool]$IsArticle
	)

	$bitmap = [System.Drawing.Bitmap]::new(1200, 630, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
	$bitmap.SetResolution(96, 96)
	$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
	$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
	$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

	$background = [System.Drawing.SolidBrush]::new((New-Color "#F7F6F2"))
	$primary = [System.Drawing.SolidBrush]::new((New-Color "#0C182A"))
	$secondary = [System.Drawing.SolidBrush]::new((New-Color "#5D6673"))
	$muted = [System.Drawing.SolidBrush]::new((New-Color "#7A828D"))
	$accent = [System.Drawing.SolidBrush]::new((New-Color "#1E5CB8"))
	$hairline = [System.Drawing.Pen]::new((New-Color "#D5D7D8"), 2)

	$brandFont = [System.Drawing.Font]::new("Segoe UI Semibold", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
	$labelFont = [System.Drawing.Font]::new("Noto Sans SC Medium", 17, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
	$descriptionFont = [System.Drawing.Font]::new("Noto Sans SC", 23, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
	$footerFont = [System.Drawing.Font]::new("Segoe UI Semibold", 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
	$titleFormat = [System.Drawing.StringFormat]::GenericTypographic.Clone()
	$titleFormat.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
	$titleFormat.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
	$descriptionFormat = [System.Drawing.StringFormat]::GenericTypographic.Clone()
	$descriptionFormat.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
	$descriptionFormat.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
	$rightFormat = [System.Drawing.StringFormat]::new()
	$rightFormat.Alignment = [System.Drawing.StringAlignment]::Far

	try {
		$graphics.FillRectangle($background, 0, 0, 1200, 630)
		$graphics.FillRectangle($accent, 72, 68, 48, 4)
		$graphics.DrawString("PROJECT FIELD NOTES", $brandFont, $primary, 72, 96)
		$graphics.DrawString($TopRight.ToUpperInvariant(), $labelFont, $muted, [System.Drawing.RectangleF]::new(650, 98, 478, 36), $rightFormat)
		$graphics.DrawLine($hairline, 72, 151, 1128, 151)

		$titleFamily = if ($IsArticle) { "Noto Sans SC Medium" } else { "Segoe UI Semibold" }
		$titleMaximum = if ($IsArticle) { 57 } else { 76 }
		$titleMinimum = if ($IsArticle) { 43 } else { 62 }
		$titleRect = if ($IsArticle) {
			[System.Drawing.RectangleF]::new(72, 190, 1056, 220)
		} else {
			[System.Drawing.RectangleF]::new(72, 205, 1056, 110)
		}
		$titleFont = New-FittedFont -Graphics $graphics -Text $Title -Family $titleFamily -MaximumSize $titleMaximum -MinimumSize $titleMinimum -Width $titleRect.Width -Height $titleRect.Height -Format $titleFormat
		try {
			$graphics.DrawString($Title, $titleFont, $primary, $titleRect, $titleFormat)
		} finally {
			$titleFont.Dispose()
		}

		$descriptionTop = if ($IsArticle) { 435 } else { 345 }
		$descriptionHeight = if ($IsArticle) { 78 } else { 90 }
		$descriptionRect = [System.Drawing.RectangleF]::new(72, $descriptionTop, 930, $descriptionHeight)
		$graphics.DrawString($Description, $descriptionFont, $secondary, $descriptionRect, $descriptionFormat)

		$graphics.DrawLine($hairline, 72, 552, 1128, 552)
		$graphics.DrawString($BottomLeft.ToUpperInvariant(), $footerFont, $muted, 72, 578)
		$graphics.DrawString("oocxx.com", $footerFont, $muted, [System.Drawing.RectangleF]::new(850, 578, 278, 28), $rightFormat)

		$directory = Split-Path -Parent $OutputPath
		New-Item -ItemType Directory -Path $directory -Force | Out-Null
		$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
	} finally {
		$rightFormat.Dispose()
		$descriptionFormat.Dispose()
		$titleFormat.Dispose()
		$footerFont.Dispose()
		$descriptionFont.Dispose()
		$labelFont.Dispose()
		$brandFont.Dispose()
		$hairline.Dispose()
		$accent.Dispose()
		$muted.Dispose()
		$secondary.Dispose()
		$primary.Dispose()
		$background.Dispose()
		$graphics.Dispose()
		$bitmap.Dispose()
	}
}

New-SocialCard `
	-Title "Project Field Notes" `
	-Description "Anonymized technical postmortems from real work. The failure mode, evidence, and reusable fix remain." `
	-TopRight "Independent technical notes" `
	-BottomLeft "Failure mode  /  Evidence  /  Verified fix" `
	-OutputPath (Join-Path $socialDir "project-field-notes-v2.png") `
	-IsArticle $false

$posts = Get-ChildItem -LiteralPath (Join-Path $root "content\posts") -Filter "*.md" -File |
	Where-Object { $_.Name -notin @("_index.md", "index.md") } |
	ForEach-Object {
		$text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
		$imagePath = Get-SocialImagePath -Text $text
		if (-not $imagePath) { return }

		[pscustomobject]@{
			Title = Get-FrontmatterValue -Text $text -Key "title"
			Description = Get-FrontmatterValue -Text $text -Key "summary"
			Date = [datetimeoffset]::Parse((Get-FrontmatterValue -Text $text -Key "date"))
			Series = Get-FrontmatterListFirst -Text $text -Key "series"
			ImagePath = $imagePath
		}
	} |
	Sort-Object Date

$index = 0
foreach ($post in $posts) {
	$index += 1
	$relativePath = $post.ImagePath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
	$outputPath = Join-Path (Join-Path $root "public") $relativePath
	$noteNumber = $index.ToString("000")
	$topRight = "Field note / $noteNumber"
	if ($post.Series) { $topRight += " / " + $post.Series }

	New-SocialCard `
		-Title $post.Title `
		-Description $post.Description `
		-TopRight $topRight `
		-BottomLeft "Anonymized  /  Evidence-led  /  Reusable" `
		-OutputPath $outputPath `
		-IsArticle $true
}

Write-Host "Generated $($posts.Count + 1) social cards in $socialDir"
