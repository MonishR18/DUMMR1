import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from core.security import get_password_hash
from models.user import User
from models.service import Category, Service, ServicePackage
from models.order import Order, OrderStatus, Review
from models.messaging import Conversation, Message
from models.notification import Notification

def seed():
    db = SessionLocal()
    try:
        # 1. Categories
        categories_data = [
            ("Design", "design", "Graphic design, logos, and visual brand identity."),
            ("Video", "video", "Commercial video production, editing, and animation."),
            ("Programming", "programming", "Full-stack web, mobile, and software development."),
            ("AI", "ai", "Custom LLM integrations, fine-tuning, and RAG pipelines."),
            ("Writing", "writing", "Copywriting, technical documentation, and translations."),
        ]

        cat_map = {}
        for name, slug, desc in categories_data:
            cat = db.query(Category).filter(Category.slug == slug).first()
            if not cat:
                cat = Category(name=name, slug=slug, description=desc)
                db.add(cat)
                db.commit()
                db.refresh(cat)
            cat_map[slug] = cat

        # 2. Users
        # Provider 1: John Studio
        john = db.query(User).filter(User.email == "john.studio@dummr.services").first()
        if not john:
            john = User(
                name="John Studio",
                username="johnstudio",
                email="john.studio@dummr.services",
                hashed_password=get_password_hash("Password123!"),
                role="PROVIDER",
                specialty="Cinematic 4K Video Director",
                bio="Professional video director and editor with over 8 years experience crafting commercials and digital campaigns.",
                is_verified=True,
                is_active=True,
            )
            db.add(john)
            db.commit()
            db.refresh(john)

        # Provider 2: Alex Tech
        alex = db.query(User).filter(User.email == "alex.tech@dummr.services").first()
        if not alex:
            alex = User(
                name="Alex Tech",
                username="alextech",
                email="alex.tech@dummr.services",
                hashed_password=get_password_hash("Password123!"),
                role="PROVIDER",
                specialty="Senior Full-Stack Engineer",
                bio="Building production React, Node, and FastAPI applications with clean architecture and rock-solid reliability.",
                is_verified=True,
                is_active=True,
            )
            db.add(alex)
            db.commit()
            db.refresh(alex)

        # Client: Sarah Client
        sarah = db.query(User).filter(User.email == "sarah.client@dummr.services").first()
        if not sarah:
            sarah = User(
                name="Sarah Client",
                username="sarahclient",
                email="sarah.client@dummr.services",
                hashed_password=get_password_hash("Password123!"),
                role="CLIENT",
                specialty="Marketing Director",
                bio="Building consumer SaaS products and commissioning high-quality freelance talent.",
                is_verified=True,
                is_active=True,
            )
            db.add(sarah)
            db.commit()
            db.refresh(sarah)

        # 3. Services & Packages
        # Service 1: Video
        import json
        s1 = db.query(Service).filter(Service.slug == "cinematic-4k-promotional-video").first()
        if not s1:
            s1 = Service(
                title="I will create a cinematic 4K promotional video for your brand",
                slug="cinematic-4k-promotional-video",
                description="I am a professional video director with over 8 years of experience. Every video is produced in 4K resolution with custom color grading, sound design, and royalty-free background audio.",
                category_id=cat_map["video"].id,
                seller_id=john.id,
                status="PUBLISHED",
                rating=4.9,
                review_count=127,
            )
            db.add(s1)
            db.commit()
            db.refresh(s1)

            # Packages for s1
            p1_basic = ServicePackage(
                service_id=s1.id,
                name="Basic",
                price=30.0,
                delivery_days=2,
                revisions=1,
                features=json.dumps(["Up to 1080p resolution output", "1 Revision included", "Royalty-free background music"]),
            )
            p1_std = ServicePackage(
                service_id=s1.id,
                name="Standard",
                price=60.0,
                delivery_days=4,
                revisions=3,
                features=json.dumps(["Up to 4K resolution output", "3 Revisions included", "Sound design & mastering", "Custom color grading"]),
            )
            p1_prem = ServicePackage(
                service_id=s1.id,
                name="Premium",
                price=120.0,
                delivery_days=7,
                revisions=99,
                features=json.dumps(["Up to 4K resolution output", "Unlimited Revisions", "Source project files included", "Commercial broadcast rights"]),
            )
            db.add_all([p1_basic, p1_std, p1_prem])
            db.commit()

        # Service 2: Programming
        s2 = db.query(Service).filter(Service.slug == "responsive-react-fastapi-web-app").first()
        if not s2:
            s2 = Service(
                title="I will build your responsive React and FastAPI web application",
                slug="responsive-react-fastapi-web-app",
                description="Full-stack web application development using React 19, FastAPI, PostgreSQL, and Docker. Clean code, RESTful API design, automated test coverage, and responsive layouts.",
                category_id=cat_map["programming"].id,
                seller_id=alex.id,
                status="PUBLISHED",
                rating=5.0,
                review_count=89,
            )
            db.add(s2)
            db.commit()
            db.refresh(s2)

            p2_basic = ServicePackage(
                service_id=s2.id,
                name="Basic",
                price=50.0,
                delivery_days=3,
                revisions=2,
                features=json.dumps(["Landing page layout", "Mobile responsive styling", "Source code delivery"]),
            )
            p2_std = ServicePackage(
                service_id=s2.id,
                name="Standard",
                price=150.0,
                delivery_days=6,
                revisions=4,
                features=json.dumps(["Full React SPA frontend", "FastAPI backend CRUD endpoints", "PostgreSQL database integration"]),
            )
            p2_prem = ServicePackage(
                service_id=s2.id,
                name="Premium",
                price=300.0,
                delivery_days=10,
                revisions=99,
                features=json.dumps(["Full production web app", "Auth JWT & RBAC", "Docker containerization & CI/CD deployment"]),
            )
            db.add_all([p2_basic, p2_std, p2_prem])
            db.commit()

        # 4. Sample Order & Review
        ord1 = db.query(Order).filter(Order.buyer_id == sarah.id, Order.service_id == s1.id).first()
        if not ord1:
            pkg_std = db.query(ServicePackage).filter(ServicePackage.service_id == s1.id, ServicePackage.name == "Standard").first()
            ord1 = Order(
                buyer_id=sarah.id,
                seller_id=john.id,
                service_id=s1.id,
                package_id=pkg_std.id,
                amount=60.0,
                status=OrderStatus.DELIVERED,
                requirements="Need a 90-second promotional clip for our landing page. Warm color grading and upbeat audio.",
                delivery_message="Hey Sarah, the 4K render is finalized! The video file is attached and ready for your review.",
            )
            db.add(ord1)
            db.commit()
            db.refresh(ord1)

        # 5. Conversations & Messages
        conv = db.query(Conversation).filter(
            (Conversation.buyer_id == sarah.id) & (Conversation.seller_id == john.id)
        ).first()

        if not conv:
            conv = Conversation(
                buyer_id=sarah.id,
                seller_id=john.id,
                order_id=ord1.id if ord1 else None,
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)

            m1 = Message(conversation_id=conv.id, sender_id=sarah.id, content="Hi John! Looking forward to working together on the promo video.")
            m2 = Message(conversation_id=conv.id, sender_id=john.id, content="Hi Sarah! I received your requirements. I'm starting work on the rough cut now.")
            m3 = Message(conversation_id=conv.id, sender_id=john.id, content="The 4K render is complete and delivered in your dashboard!")
            db.add_all([m1, m2, m3])
            db.commit()

        print("==> Demo seed data successfully created!")
        print(f"    - Provider: john.studio@dummr.services / Password123!")
        print(f"    - Provider: alex.tech@dummr.services / Password123!")
        print(f"    - Client:   sarah.client@dummr.services / Password123!")
        print(f"    - Services: 2 published with 3 tiers each")
        print(f"    - Orders:   1 delivered active order with conversation")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
