from datetime import date, timedelta
import re

from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Date, Float, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from data_model_complaint import Base, engine


class MarketplaceProduct(Base):
    __tablename__ = "marketplace_products"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    owner: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    owner_name: Mapped[str] = mapped_column(String(120), nullable=False)
    price: Mapped[int] = mapped_column(nullable=False)
    deposit: Mapped[int] = mapped_column(nullable=False)
    condition: Mapped[str] = mapped_column(String(32), nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    available_from: Mapped[date] = mapped_column(Date, nullable=False)
    available_to: Mapped[date] = mapped_column(Date, nullable=False)
    rules: Mapped[str] = mapped_column(Text, nullable=False)
    art: Mapped[str] = mapped_column(String(32), nullable=False)


class MarketplaceChatMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=2000)


class MarketplaceChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[MarketplaceChatMessage] = Field(default_factory=list, max_length=10)


Base.metadata.create_all(engine)


PRODUCTS = (
    ("Casio fx-991EX scientific calculator", "Academic", "calculator", 30, 500,
     "A reliable scientific calculator for engineering classes and exams.", "Return with its protective cover."),
    ("Canon EOS 200D camera", "Photography", "camera", 350, 2000,
     "A DSLR camera with a kit lens for campus events and photography projects.", "Keep dry and return the battery charged."),
    ("Arduino starter kit", "Project Equipment", "chip", 60, 700,
     "Arduino-compatible board with sensors, jumper wires, and project components.", "Return all components in the organizer."),
    ("Engineering mathematics textbook", "Books", "book", 15, 200,
     "A reference book with worked examples for engineering mathematics.", "Do not write or highlight on pages."),
    ("HP Pavilion laptop", "Electronics", "chip", 450, 3000,
     "A student laptop suitable for coding, reports, and online coursework.", "Return the charger and laptop sleeve."),
    ("Tripod with phone mount", "Photography", "camera", 45, 300,
     "Adjustable tripod with a universal phone mount for video and photography.", "Fold the legs before returning."),
    ("Raspberry Pi 4 kit", "Project Equipment", "chip", 100, 1000,
     "Single-board computer kit with power supply and case for prototyping.", "Shut down safely and return the power supply."),
    ("Gaming controller", "Gaming", "chip", 80, 800,
     "Wireless controller for compatible PC games and student events.", "Return with the charging cable."),
    ("Digital multimeter", "Electronics", "chip", 40, 400,
     "Portable digital multimeter for basic electronics and circuit testing.", "Return probes and meter in the case."),
    ("CAD design reference book", "Books", "book", 20, 250,
     "A practical reference for introductory CAD and technical drawing.", "Keep the book clean and dry."),
    ("Portable projector", "Electronics", "chip", 250, 1800,
     "Compact projector for group presentations and project demonstrations.", "Return the HDMI adapter and remote."),
    ("USB microphone", "Project Equipment", "chip", 90, 600,
     "USB microphone for presentations, podcasts, and recorded coursework.", "Store in the supplied pouch."),
    ("Chemistry lab goggles", "Academic", "book", 10, 100,
     "Protective goggles for approved teaching-lab activities.", "Clean and return after use."),
    ("Acoustic guitar", "Other", "book", 120, 1000,
     "A student acoustic guitar for practice and campus music sessions.", "Use the protective case when transporting."),
    ("Ring light with stand", "Photography", "camera", 55, 350,
     "Dimmable ring light for video calls, interviews, and content projects.", "Pack the stand and phone holder together."),
    ("Portable SSD 1TB", "Electronics", "chip", 100, 1000,
     "Portable solid-state drive for project files and class media.", "Safely eject and return the USB cable."),
    ("Mechanical drawing set", "Academic", "book", 18, 150,
     "Technical drawing tools for engineering graphics coursework.", "Return all instruments in the case."),
    ("Wireless presentation clicker", "Electronics", "chip", 35, 250,
     "Presentation remote with a USB receiver for classroom presentations.", "Return the receiver with the clicker."),
    ("DSLR camera lens 50mm", "Photography", "camera", 180, 1200,
     "A portrait lens compatible with selected Canon DSLR camera bodies.", "Keep lens caps on when not in use."),
    ("Breadboard and sensor bundle", "Project Equipment", "chip", 35, 300,
     "Breadboard, jumper wires, and common sensors for electronics prototyping.", "Return sensors and wires in the labeled box."),
)

OWNERS = (
    ("S1", "Aarav Sharma"), ("S2", "Diya Nair"), ("S3", "Arjun Kumar"),
    ("S4", "Meera Krishnan"), ("S5", "Rohan Patel"), ("S6", "Ananya Rao"),
    ("S7", "Kavin Raj"), ("S8", "Ishita Singh"), ("S9", "Aditya Menon"),
    ("S10", "Sneha Reddy"), ("S11", "Pranav S"), ("S12", "Nila Arun"),
)
LOCATIONS = (
    "Library Block", "Main Block", "Innovation Centre", "CSE Department",
    "Student Centre", "ECE Department",
)
CONDITIONS = ("Like new", "Good", "Fair")


def seed_marketplace_products() -> int:
    today = date.today()
    with Session(engine) as session:
        for index in range(100):
            template_index = index % len(PRODUCTS)
            name, category, art, price, deposit, description, rules = PRODUCTS[
                template_index
            ]
            owner_id, owner_name = OWNERS[index % len(OWNERS)]
            condition = CONDITIONS[(index // 3 + template_index) % len(CONDITIONS)]
            product = MarketplaceProduct(
                id=f"DBP-{index + 1:04d}",
                name=(
                    name
                    if index < len(PRODUCTS)
                    else f"{name} (set {index // len(PRODUCTS) + 1})"
                ),
                category=category,
                description=description,
                owner=owner_id,
                owner_name=owner_name,
                price=price + (index // len(PRODUCTS)) * 5,
                deposit=deposit + (index // len(PRODUCTS)) * 50,
                condition=condition,
                rating=round(4.1 + ((index * 7) % 9) / 10, 1),
                location=LOCATIONS[index % len(LOCATIONS)],
                available=True,
                available_from=today,
                available_to=today + timedelta(days=90),
                rules=rules,
                art=art,
            )
            session.merge(product)
        session.commit()
        return 100


def list_marketplace_products() -> list[MarketplaceProduct]:
    with Session(engine) as session:
        return session.scalars(
            select(MarketplaceProduct).order_by(MarketplaceProduct.id)
        ).all()


def marketplace_product_payload(product: MarketplaceProduct) -> dict[str, object]:
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "description": product.description,
        "owner": product.owner,
        "ownerName": product.owner_name,
        "price": product.price,
        "deposit": product.deposit,
        "condition": product.condition,
        "rating": product.rating,
        "location": product.location,
        "available": product.available,
        "from": product.available_from.isoformat(),
        "to": product.available_to.isoformat(),
        "rules": product.rules,
        "art": product.art,
    }


def find_marketplace_products(query: str) -> list[MarketplaceProduct]:
    products = list_marketplace_products()
    tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", query.casefold())
        if len(token) > 2
        and not token.isdigit()
        and token
        not in {
            "the", "and", "for", "with", "can", "you", "need", "want",
            "show", "find", "under", "below", "near", "day", "days", "per",
            "rupee", "rupees", "available", "borrow", "rental", "rent",
            "item", "items", "product", "products", "from", "within",
        }
    }
    budget = None
    budget_match = re.search(
        r"(?:under|below|less than|max(?:imum)?|within)\s*₹?\s*(\d+)",
        query,
        re.IGNORECASE,
    )
    if budget_match:
        budget = int(budget_match.group(1))

    def score(product: MarketplaceProduct) -> tuple[int, int, int, int, float]:
        name_category = f"{product.name} {product.category}".casefold()
        description = product.description.casefold()
        location = product.location.casefold()
        primary_matches = sum(token in name_category for token in tokens)
        description_matches = sum(token in description for token in tokens)
        location_matches = sum(token in location for token in tokens)
        over_budget = int(budget is not None and product.price > budget)
        return (
            int(over_budget == 0),
            primary_matches,
            description_matches,
            location_matches,
            product.rating,
        )

    ranked = sorted(
        (product for product in products if product.available),
        key=score,
        reverse=True,
    )
    relevant = [product for product in ranked if score(product)[1:4] != (0, 0, 0)]
    if budget is not None:
        relevant = [product for product in relevant if product.price <= budget]
        return relevant[:5]
    return (relevant or ranked)[:5]
