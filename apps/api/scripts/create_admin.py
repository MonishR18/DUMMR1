import sys
import os
import argparse

# Add parent directory to sys.path so we can import apps modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from models.user import User
from core.security import get_password_hash

def main():
    parser = argparse.ArgumentParser(description="Create or promote an admin user for DUMMR")
    parser.add_argument("--promote", type=str, help="Username or email of existing user to promote to ADMIN")
    parser.add_argument("--username", type=str, help="Username for new admin")
    parser.add_argument("--email", type=str, help="Email for new admin")
    parser.add_argument("--password", type=str, help="Password for new admin (min 8 chars)")
    parser.add_argument("--name", type=str, default="Administrator", help="Full name for new admin")

    args = parser.parse_args()
    db = SessionLocal()
    try:
        if args.promote:
            identifier = args.promote.strip()
            user = db.query(User).filter((User.username == identifier) | (User.email == identifier)).first()
            if not user:
                print(f"Error: User '{identifier}' not found.")
                sys.exit(1)
            user.role = "ADMIN"
            user.is_verified = True
            db.commit()
            print(f"Success: User '{user.username}' (ID: {user.id}) promoted to ADMIN.")
            return

        if not args.username or not args.email or not args.password:
            print("Error: To create a new admin, --username, --email, and --password are required.")
            print("Usage: python scripts/create_admin.py --username admin --email admin@dummr.com --password secretpass")
            print("   or: python scripts/create_admin.py --promote <username_or_email>")
            sys.exit(1)

        if len(args.password) < 8:
            print("Error: Password must be at least 8 characters long.")
            sys.exit(1)

        # Check existing
        if db.query(User).filter(User.username == args.username).first():
            print(f"Error: Username '{args.username}' is already registered.")
            sys.exit(1)
        if db.query(User).filter(User.email == args.email).first():
            print(f"Error: Email '{args.email}' is already registered.")
            sys.exit(1)

        new_admin = User(
            name=args.name,
            username=args.username,
            email=args.email,
            hashed_password=get_password_hash(args.password),
            role="ADMIN",
            is_active=True,
            is_verified=True,
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        print(f"Success: Admin user '{new_admin.username}' created successfully (ID: {new_admin.id}).")
    finally:
        db.close()

if __name__ == "__main__":
    main()
