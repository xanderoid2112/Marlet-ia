# canasta-vegana.ps1 - Canasta vegana económica
Write-Host "=== CANASTA VEGANA ECONÓMICA ===" -ForegroundColor Green

Write-Host "`n🥦 Generando canasta vegana con presupuesto ajustado..." -ForegroundColor Yellow

$body = @{
    usuario_id = 1
    presupuesto = 35.0
    productos_deseados = @(1, 2, 8)  # Arroz, Leche Almendras, Espinacas
    preferencias = @{
        marcas_preferidas = @("GreatValue", "AlmondBreeze", "GreenFields")
        dietas = @("vegano")
        categorias_excluidas = @("Carnes", "Pescados", "Lácteos")
    }
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "https://marlet-ia-production.up.railway.app/api/canastas/generar" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30

    Write-Host "`n   ✅ CANASTA VEGANA GENERADA!" -ForegroundColor Green
    Write-Host "   🥬 Productos veganos: $($result.productos.Count)" -ForegroundColor White
    Write-Host "   💰 Total: `$$($result.total)" -ForegroundColor White
    Write-Host "   💵 Ahorro: `$$($result.ahorro) ($([math]::Round($result.porcentajeAhorro, 2))`%)" -ForegroundColor Green

    Write-Host "`n   🛒 PRODUCTOS VEGANOS:" -ForegroundColor Cyan
    $result.productos | ForEach-Object {
        $icon = if ($_.esDeseado) { "⭐" } else { "🌱" }
        Write-Host "   $icon $($_.nombre) - `$$($_.precio) | $($_.categoria)" -ForegroundColor $(if ($_.esDeseado) { "Yellow" } else { "Gray" })
    }

} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}