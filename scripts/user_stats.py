import json
import sys

def analyze_users(users_file):
    try:
        with open(users_file, 'r') as f:
            users = json.load(f)
        
        roles = {}
        branches = {}
        
        for user in users:
            role = user.get('role', 'Unknown')
            branch = user.get('branch', 'Unknown')
            
            roles[role] = roles.get(role, 0) + 1
            branches[branch] = branches.get(branch, 0) + 1
            
        print("User Statistics Analysis")
        print("=========================")
        print(f"Total Users: {len(users)}")
        print("\nBy Role:")
        for role, count in roles.items():
            print(f"  - {role}: {count}")
            
        print("\nBy Branch:")
        for branch, count in branches.items():
            print(f"  - {branch}: {count}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_users(sys.argv[1])
    else:
        print("Usage: python user_stats.py <users_json_file>")
