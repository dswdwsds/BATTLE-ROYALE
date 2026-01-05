$grass = [Convert]::ToBase64String([IO.File]::ReadAllBytes('assets/grass.png'))
$sand = [Convert]::ToBase64String([IO.File]::ReadAllBytes('assets/sand.png'))
$night = [Convert]::ToBase64String([IO.File]::ReadAllBytes('assets/night.png'))
$brick = [Convert]::ToBase64String([IO.File]::ReadAllBytes('assets/brick.png'))
$concrete = [Convert]::ToBase64String([IO.File]::ReadAllBytes('assets/concrete.png'))
$metal = [Convert]::ToBase64String([IO.File]::ReadAllBytes('assets/metal.png'))

$content = "window.TEXTURE_DATA = {`n"
$content += "  // Ground textures`n"
$content += "  grass: 'data:image/png;base64,$grass',`n"
$content += "  sand: 'data:image/png;base64,$sand',`n"
$content += "  night: 'data:image/png;base64,$night',`n"
$content += "  // Building textures`n"
$content += "  brick: 'data:image/png;base64,$brick',`n"
$content += "  concrete: 'data:image/png;base64,$concrete',`n"
$content += "  metal: 'data:image/png;base64,$metal'`n"
$content += "};"

$content | Out-File -FilePath "js/game-textures.js" -Encoding utf8
