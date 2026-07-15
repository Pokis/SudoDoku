param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\icons'))

Add-Type -AssemblyName System.Drawing

function Add-RoundedRectangle($path, $x, $y, $width, $height, $radius) {
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
}

function New-SudodokuIcon([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $scale = $size / 512.0

  $outer = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRectangle $outer 0 0 $size $size (116 * $scale)
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(0, 0)),
    (New-Object System.Drawing.PointF($size, $size)),
    [System.Drawing.Color]::FromArgb(139, 124, 255),
    [System.Drawing.Color]::FromArgb(87, 70, 232)
  )
  $graphics.FillPath($gradient, $outer)

  $opacities = @(255, 148, 217, 122, 245, 122, 217, 148, 255)
  for ($row = 0; $row -lt 3; $row++) {
    for ($column = 0; $column -lt 3; $column++) {
      $index = $row * 3 + $column
      $x = (104 + $column * 108) * $scale
      $y = (104 + $row * 108) * $scale
      $square = New-Object System.Drawing.Drawing2D.GraphicsPath
      Add-RoundedRectangle $square $x $y (88 * $scale) (88 * $scale) (22 * $scale)
      $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($opacities[$index], 255, 255, 255))
      $graphics.FillPath($brush, $square)
      $brush.Dispose(); $square.Dispose()
    }
  }

  $target = Join-Path $OutputDirectory "icon-$size.png"
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $gradient.Dispose(); $outer.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-SudodokuIcon 192
New-SudodokuIcon 512
