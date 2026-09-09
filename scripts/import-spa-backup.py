from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "attached_assets"
OUTPUT = ROOT / "artifacts" / "api-server" / "src" / "data" / "spa-backup.json"


def text(value: object) -> str:
    return "" if value is None else str(value).strip()


def normalized_name(value: object) -> str:
    value = unicodedata.normalize("NFKD", text(value))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", value).strip().casefold()


def phone(value: object) -> str:
    digits = re.sub(r"\D", "", text(value).removesuffix(".0"))
    if len(digits) > 11 and digits.startswith("55"):
        digits = digits[2:]
    return digits


def integer(value: object) -> int:
    match = re.search(r"-?\d+", text(value))
    return int(match.group()) if match else 0


def number(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    raw = text(value).replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def rows(path: Path) -> list[dict[str, object]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook.active
    values = worksheet.iter_rows(values_only=True)
    headers = [text(value) for value in next(values)]
    return [
        dict(zip(headers, row))
        for row in values
        if any(value not in (None, "") for value in row)
    ]


def initials(name: str) -> str:
    parts = [part for part in name.split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "SB"


def clean_client_name(value: object) -> str:
    raw = text(value).replace("\\", "")
    letters = "".join(char for char in raw if char.isalpha())
    digits = re.sub(r"\D", "", raw)
    if len(letters) < 2 or (len(digits) >= 8 and len(letters) < 4):
        return "Cadastro sem nome"
    return re.sub(r"\s+", " ", raw).strip()


def main() -> None:
    client_file = next(ASSETS.glob("Clientes_SpaeBronze_*.xlsx"))
    billing_file = next(ASSETS.glob("Faturamento_SpaeBronze_*.xlsx"))
    inventory_file = next(ASSETS.glob("Financeiro_SpaeBronze_*.xlsx"))

    client_rows = rows(client_file)
    billing_rows = rows(billing_file)
    inventory_rows = rows(inventory_file)

    billing_by_phone: dict[str, dict[str, float]] = {}
    billing_by_name: dict[str, dict[str, float]] = {}
    for row in billing_rows:
        summary = {
            "orders": number(row.get("Nº Comandas")),
            "revenue": number(row.get("Faturamento")),
            "averageTicket": number(row.get("Ticket Médio")),
        }
        normalized_phone = phone(row.get("Celular"))
        normalized_client = normalized_name(row.get("Cliente"))
        if normalized_phone:
            current = billing_by_phone.setdefault(
                normalized_phone, {"orders": 0, "revenue": 0, "averageTicket": 0}
            )
            current["orders"] += summary["orders"]
            current["revenue"] += summary["revenue"]
        if normalized_client:
            current = billing_by_name.setdefault(
                normalized_client, {"orders": 0, "revenue": 0, "averageTicket": 0}
            )
            current["orders"] += summary["orders"]
            current["revenue"] += summary["revenue"]

    clients = []
    for index, row in enumerate(client_rows, start=1):
        name = clean_client_name(row.get("Cliente"))
        normalized_phone = phone(row.get("Celular") or row.get("Telefone"))
        billing = billing_by_phone.get(normalized_phone) or billing_by_name.get(
            normalized_name(name)
        ) or {"orders": 0, "revenue": 0, "averageTicket": 0}
        orders = int(billing["orders"])
        revenue = round(billing["revenue"], 2)
        clients.append(
            {
                "id": index,
                "name": name,
                "initials": initials(name),
                "lastVisit": text(row.get("Data Cadastro")),
                "service": f"{orders} comanda(s) · R$ {revenue:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
                "status": "active" if orders > 1 else ("new" if orders == 1 else "at_risk"),
                "source": text(row.get("Como Conheceu")) or "Não informado",
                "phone": normalized_phone,
                "birthDate": text(row.get("Data Nascimento")),
                "registeredAt": text(row.get("Data Cadastro")),
                "orders": orders,
                "revenue": revenue,
            }
        )

    inventory = []
    now = datetime.now()
    for index, row in enumerate(inventory_rows, start=1):
        minimum = integer(row.get("Estoque Mínimo"))
        stock = integer(row.get("Em Estoque"))
        expiration = text(row.get("Prox. Vencimento"))
        expired = False
        try:
            expired = datetime.strptime(expiration, "%d/%m/%Y") < now
        except ValueError:
            pass
        status = "expired" if expired else ("negative" if stock < 0 else ("low" if stock <= minimum else "ok"))
        inventory.append(
            {
                "id": index,
                "name": text(row.get("Produto")),
                "brand": text(row.get("Marca")) or "Sem marca",
                "category": text(row.get("Categoria")) or "Sem categoria",
                "price": number(row.get("Preço")),
                "minimumStock": minimum,
                "stock": stock,
                "nextExpiration": expiration,
                "status": status,
            }
        )

    total_revenue = round(sum(number(row.get("Faturamento")) for row in billing_rows), 2)
    total_orders = int(sum(number(row.get("Nº Comandas")) for row in billing_rows))
    payload = {
        "meta": {
            "clients": len(clients),
            "billingRecords": len(billing_rows),
            "inventoryItems": len(inventory),
            "totalRevenue": total_revenue,
            "totalOrders": total_orders,
            "generatedAt": datetime.now().isoformat(),
        },
        "clients": clients,
        "inventory": inventory,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()