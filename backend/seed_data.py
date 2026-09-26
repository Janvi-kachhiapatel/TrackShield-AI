import random
import datetime
from backend.security import hash_password
from backend.database import SessionLocal, engine, Base
from backend.models import (
    Department, User, Station, Corridor, Asset, Manpower, Resource,
    TrainSchedule, MaintenanceRequest, MaintenanceBlock, BlockJob,
    Conflict, AIRecommendation, MCRReport, Notification, AuditLog,
    EmergencyEvent, WorkProgress
)

def hash_pw(password: str) -> str:
    # PBKDF2-HMAC-SHA256 with per-user salt (same scheme used by login).
    return hash_password(password)

def seed_database():
    print("[INFO] Creating database schema for Indian Railways Control Center...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    random.seed(42)

    print("[INFO] Seeding Departments...")
    departments_data = [
        {"code": "ELEC", "name": "Electrical (Traction Distribution)", "hod_name": "Rahul Patel", "head_count": 85, "icon": "Zap"},
        {"code": "SIG", "name": "Signalling (SMMS)", "hod_name": "Amit Shah", "head_count": 70, "icon": "Radio"},
        {"code": "CIVIL", "name": "Civil Engineering (TMS - Track)", "hod_name": "Rajesh Sharma", "head_count": 120, "icon": "Hammer"},
        {"code": "TEL", "name": "Telecommunications", "hod_name": "Vikram Verma", "head_count": 45, "icon": "Wifi"},
        {"code": "MECH", "name": "Mechanical (C&W)", "hod_name": "Sanjay Gupta", "head_count": 60, "icon": "Wrench"},
        {"code": "ALL", "name": "Head of All Departments", "hod_name": "Keval Rana", "head_count": 380, "icon": "ShieldAlert"},
    ]
    dept_map = {}
    for d in departments_data:
        dept = Department(**d)
        db.add(dept)
        db.flush()
        dept_map[d["code"]] = dept

    print("[INFO] Seeding Demo Users...")
    users_data = [
        {"emp_id": "hod001", "name": "Keval Rana", "email": "keval.rana@railnet.gov.in", "password_hash": hash_pw("hod123"), "role": "HIGHER_HOD", "department_id": dept_map["ALL"].id},
        {"emp_id": "elec001", "name": "Rahul Patel", "email": "rahul.patel@railnet.gov.in", "password_hash": hash_pw("elec123"), "role": "LOWER_HOD", "department_id": dept_map["ELEC"].id},
        {"emp_id": "sig001", "name": "Amit Shah", "email": "amit.shah@railnet.gov.in", "password_hash": hash_pw("sig123"), "role": "LOWER_HOD", "department_id": dept_map["SIG"].id},
        {"emp_id": "civil001", "name": "Rajesh Sharma", "email": "rajesh.sharma@railnet.gov.in", "password_hash": hash_pw("civil123"), "role": "LOWER_HOD", "department_id": dept_map["CIVIL"].id},
        {"emp_id": "tel001", "name": "Vikram Verma", "email": "vikram.verma@railnet.gov.in", "password_hash": hash_pw("tel123"), "role": "LOWER_HOD", "department_id": dept_map["TEL"].id},
        {"emp_id": "mech001", "name": "Sanjay Gupta", "email": "sanjay.gupta@railnet.gov.in", "password_hash": hash_pw("mech123"), "role": "LOWER_HOD", "department_id": dept_map["MECH"].id},
        {"emp_id": "admin001", "name": "System Administrator", "email": "admin@railnet.gov.in", "password_hash": hash_pw("admin123"), "role": "ADMIN", "department_id": dept_map["ALL"].id},
    ]
    user_map = {}
    for u in users_data:
        usr = User(**u)
        db.add(usr)
        db.flush()
        user_map[u["emp_id"]] = usr

    print("[INFO] Seeding 70 Indian Railway Stations...")
    station_names = [
        ("NDLS", "New Delhi", "Delhi", "NR", 28.6431, 77.2197),
        ("NZM", "Hazrat Nizamuddin", "Delhi", "NR", 28.5888, 77.2534),
        ("GZB", "Ghaziabad Junction", "Delhi", "NR", 28.6517, 77.4332),
        ("ALJN", "Aligarh Junction", "Prayagraj", "NCR", 27.8974, 78.0880),
        ("TDL", "Tundla Junction", "Prayagraj", "NCR", 27.2081, 78.2415),
        ("ETW", "Etawah Junction", "Prayagraj", "NCR", 26.7769, 79.0270),
        ("CNB", "Kanpur Central", "Prayagraj", "NCR", 26.4547, 80.3507),
        ("PRYJ", "Prayagraj Junction", "Prayagraj", "NCR", 25.4358, 81.8463),
        ("DDU", "Pt. Deen Dayal Upadhyaya", "Pt Deen Dayal", "ECR", 25.2818, 83.1189),
        ("BSB", "Varanasi Junction", "Varanasi", "NER", 25.3284, 82.9866),
        ("PNBE", "Patna Junction", "Danapur", "ECR", 25.6025, 85.1376),
        ("HWH", "Howrah Junction", "Howrah", "ER", 22.5839, 88.3433),
        ("SDAH", "Sealdah", "Sealdah", "ER", 22.5697, 88.3712),
        ("AGC", "Agra Cantt", "Agra", "NCR", 27.1592, 77.9928),
        ("GWL", "Gwalior Junction", "Jhansi", "NCR", 26.2166, 78.1884),
        ("VGLJ", "Virangana Lakshmibai Jhansi", "Jhansi", "NCR", 25.4484, 78.5685),
        ("BINA", "Bina Junction", "Bhopal", "WCR", 24.1794, 78.1887),
        ("BPL", "Bhopal Junction", "Bhopal", "WCR", 23.2662, 77.4124),
        ("ET", "Itarsi Junction", "Bhopal", "WCR", 22.6139, 77.7608),
        ("KNW", "Khandwa Junction", "Bhusawal", "CR", 21.8314, 76.3498),
        ("BSL", "Bhusawal Junction", "Bhusawal", "CR", 21.0504, 75.7954),
        ("JL", "Jalgaon Junction", "Bhusawal", "CR", 21.0077, 75.5626),
        ("MMR", "Manmad Junction", "Bhusawal", "CR", 20.2547, 74.4373),
        ("NK", "Nashik Road", "Mumbai CR", "CR", 19.9576, 73.8340),
        ("IGP", "Igatpuri", "Mumbai CR", "CR", 19.6974, 73.5658),
        ("KYN", "Kalyan Junction", "Mumbai CR", "CR", 19.2354, 73.1299),
        ("TNA", "Thane", "Mumbai CR", "CR", 19.1860, 72.9759),
        ("CSMT", "Chhatrapati Shivaji Maharaj Terminus", "Mumbai CR", "CR", 18.9401, 72.8351),
        ("BCT", "Mumbai Central", "Mumbai WR", "WR", 18.9696, 72.8193),
        ("BDTS", "Bandra Terminus", "Mumbai WR", "WR", 19.0624, 72.8427),
        ("BVI", "Borivali", "Mumbai WR", "WR", 19.2288, 72.8568),
        ("VR", "Virar", "Mumbai WR", "WR", 19.4674, 72.8093),
        ("PLG", "Palghar", "Mumbai WR", "WR", 19.6975, 72.7667),
        ("DRD", "Dahanu Road", "Mumbai WR", "WR", 19.9740, 72.7360),
        ("VAPI", "Vapi", "Mumbai WR", "WR", 20.3709, 72.9106),
        ("BL", "Valsad", "Mumbai WR", "WR", 20.6094, 72.9298),
        ("ST", "Surat", "Vadodara", "WR", 21.2035, 72.8392),
        ("BRC", "Vadodara Junction", "Vadodara", "WR", 22.3107, 73.1812),
        ("ANND", "Anand Junction", "Vadodara", "WR", 22.5645, 72.9289),
        ("ADI", "Ahmedabad Junction", "Ahmedabad", "WR", 23.0232, 72.6011),
        ("MSH", "Mehsana Junction", "Ahmedabad", "WR", 23.6000, 72.4000),
        ("PNU", "Palanpur Junction", "Ahmedabad", "WR", 24.1724, 72.4346),
        ("ABR", "Abu Road", "Ajmer", "NWR", 24.4784, 72.7818),
        ("FA", "Falna", "Ajmer", "NWR", 25.2415, 73.2389),
        ("MJ", "Marwar Junction", "Ajmer", "NWR", 25.7333, 73.6167),
        ("AII", "Ajmer Junction", "Ajmer", "NWR", 26.4499, 74.6399),
        ("JP", "Jaipur Junction", "Jaipur", "NWR", 26.9196, 75.7878),
        ("BKI", "Bandikui Junction", "Jaipur", "NWR", 27.0500, 76.5667),
        ("BTE", "Bharatpur Junction", "Kota", "WCR", 27.2173, 77.4895),
        ("MTJ", "Mathura Junction", "Agra", "NCR", 27.4924, 77.6737),
        ("FDB", "Faridabad", "Delhi", "NR", 28.4089, 77.3178),
        ("LKO", "Lucknow Charbagh", "Lucknow", "NR", 26.8310, 80.9234),
        ("CNB2", "Panki Dham", "Prayagraj", "NCR", 26.4712, 80.2520),
        ("BE", "Bareilly Junction", "Moradabad", "NR", 28.3470, 79.4180),
        ("MB", "Moradabad", "Moradabad", "NR", 28.8350, 78.7750),
        ("SRE", "Saharanpur Junction", "Ambala", "NR", 29.9640, 77.5460),
        ("UMB", "Ambala Cantt", "Ambala", "NR", 30.3340, 76.8370),
        ("LDH", "Ludhiana Junction", "Firozpur", "NR", 30.9010, 75.8573),
        ("JUC", "Jalandhar City", "Firozpur", "NR", 31.3260, 75.5762),
        ("ASR", "Amritsar Junction", "Firozpur", "NR", 31.6340, 74.8723),
        ("PUNE", "Pune Junction", "Pune", "CR", 18.5284, 73.8744),
        ("DD", "Daund Junction", "Pune", "CR", 18.4650, 74.5820),
        ("KWV", "Kurduvadi Junction", "Solapur", "CR", 18.0830, 75.4330),
        ("SUR", "Solapur", "Solapur", "CR", 17.6599, 75.9064),
        ("GR", "Kalaburagi (Gulbarga)", "Solapur", "CR", 17.3297, 76.8343),
        ("WADI", "Wadi Junction", "Solapur", "CR", 17.0600, 76.9900),
        ("SC", "Secunderabad Junction", "Secunderabad", "SCR", 17.4344, 78.5011),
        ("HYB", "Hyderabad Deccan", "Secunderabad", "SCR", 17.3920, 78.4690),
        ("BZA", "Vijayawada Junction", "Vijayawada", "SCR", 16.5175, 80.6200),
        ("MAS", "Puratchi Thalaivar Dr. MGR Chennai Central", "Chennai", "SR", 13.0827, 80.2707)
    ]
    stations = []
    station_map = {}
    for code, name, div, zone, lat, lon in station_names:
        st = Station(code=code, name=name, division=div, zone=zone, latitude=lat, longitude=lon)
        db.add(st)
        db.flush()
        stations.append(st)
        station_map[code] = st

    print("[INFO] Seeding 200 Indian Railway Corridors...")
    corridors = []
    # Key main trunk sections
    main_routes = [
        ("NDLS", "GZB", "Double Line", 25.0),
        ("GZB", "ALJN", "Double Line", 106.0),
        ("ALJN", "TDL", "Double Line", 78.0),
        ("TDL", "ETW", "Double Line", 92.0),
        ("ETW", "CNB", "Double Line", 139.0),
        ("CNB", "PRYJ", "Double Line", 194.0),
        ("PRYJ", "DDU", "Double Line", 152.0),
        ("DDU", "BSB", "Double Line", 18.0),
        ("DDU", "PNBE", "Double Line", 212.0),
        ("PNBE", "HWH", "Double Line", 535.0),
        ("NDLS", "MTJ", "Quadruple", 141.0),
        ("MTJ", "AGC", "Quadruple", 54.0),
        ("AGC", "GWL", "Double Line", 118.0),
        ("GWL", "VGLJ", "Double Line", 97.0),
        ("VGLJ", "BINA", "Double Line", 153.0),
        ("BINA", "BPL", "Double Line", 139.0),
        ("BPL", "ET", "Double Line", 92.0),
        ("ET", "KNW", "Double Line", 183.0),
        ("KNW", "BSL", "Double Line", 123.0),
        ("BSL", "JL", "Double Line", 24.0),
        ("JL", "MMR", "Double Line", 160.0),
        ("MMR", "NK", "Double Line", 73.0),
        ("NK", "IGP", "Double Line", 51.0),
        ("IGP", "KYN", "Double Line", 85.0),
        ("KYN", "TNA", "Quadruple", 20.0),
        ("TNA", "CSMT", "Quadruple", 33.0),
        ("BCT", "BVI", "Quadruple", 30.0),
        ("BVI", "VR", "Quadruple", 30.0),
        ("VR", "PLG", "Double Line", 27.0),
        ("PLG", "DRD", "Double Line", 34.0),
        ("DRD", "VAPI", "Double Line", 49.0),
        ("VAPI", "BL", "Double Line", 26.0),
        ("BL", "ST", "Double Line", 69.0),
        ("ST", "BRC", "Double Line", 129.0),
        ("BRC", "ANND", "Double Line", 36.0),
        ("ANND", "ADI", "Double Line", 64.0),
        ("ADI", "MSH", "Double Line", 68.0),
        ("MSH", "PNU", "Double Line", 65.0),
        ("PNU", "ABR", "Double Line", 52.0),
        ("ABR", "FA", "Double Line", 75.0),
        ("FA", "MJ", "Double Line", 67.0),
        ("MJ", "AII", "Double Line", 140.0),
        ("AII", "JP", "Double Line", 135.0),
        ("JP", "BKI", "Double Line", 90.0),
        ("BKI", "BTE", "Double Line", 97.0),
        ("BTE", "MTJ", "Double Line", 35.0),
        ("NDLS", "FDB", "Quadruple", 28.0),
        ("FDB", "MTJ", "Quadruple", 113.0),
        ("LKO", "CNB", "Double Line", 72.0),
        ("MB", "BE", "Double Line", 90.0),
        ("BE", "LKO", "Double Line", 235.0),
        ("NDLS", "MB", "Double Line", 166.0),
        ("NDLS", "SRE", "Double Line", 181.0),
        ("SRE", "UMB", "Double Line", 81.0),
        ("UMB", "LDH", "Double Line", 114.0),
        ("LDH", "JUC", "Double Line", 57.0),
        ("JUC", "ASR", "Double Line", 79.0),
        ("KYN", "PUNE", "Double Line", 138.0),
        ("PUNE", "DD", "Double Line", 76.0),
        ("DD", "KWV", "Double Line", 108.0),
        ("KWV", "SUR", "Double Line", 79.0),
        ("SUR", "GR", "Double Line", 113.0),
        ("GR", "WADI", "Double Line", 37.0),
        ("WADI", "SC", "Double Line", 185.0),
        ("SC", "BZA", "Double Line", 349.0),
        ("BZA", "MAS", "Double Line", 431.0)
    ]

    for f_code, t_code, track, dist in main_routes:
        if f_code in station_map and t_code in station_map:
            st1 = station_map[f_code]
            st2 = station_map[t_code]
            code = f"{f_code}-{t_code}"
            name = f"{st1.name} → {st2.name}"
            status = "CRITICAL" if code in ["ALJN-TDL", "ETW-CNB"] else ("MAINTENANCE" if code in ["GZB-ALJN", "ST-BRC", "KYN-PUNE"] else "NORMAL")
            c = Corridor(code=code, name=name, from_station_id=st1.id, to_station_id=st2.id, distance_km=dist, track_type=track, status=status)
            db.add(c)
            corridors.append(c)

    # Generate additional bidirectional/loop corridors up to 200
    st_list = list(stations)
    while len(corridors) < 200:
        i1 = random.randint(0, len(st_list)-1)
        i2 = random.randint(0, len(st_list)-1)
        if i1 == i2:
            continue
        s1 = st_list[i1]
        s2 = st_list[i2]
        code = f"{s1.code}-{s2.code}"
        if any(c.code == code for c in corridors):
            continue
        c = Corridor(
            code=code,
            name=f"{s1.name} → {s2.name}",
            from_station_id=s1.id,
            to_station_id=s2.id,
            distance_km=float(random.randint(15, 120)),
            track_type=random.choice(["Double Line", "Double Line", "Quadruple", "Single Line"]),
            status=random.choice(["NORMAL", "NORMAL", "NORMAL", "MAINTENANCE", "CRITICAL"])
        )
        db.add(c)
        corridors.append(c)
    db.flush()

    print("[INFO] Seeding 400 Indian Railway Assets across Departments...")
    asset_types = {
        "ELEC": [
            ("OHE Cantilever Assembly", "HIGH"),
            ("25kV Traction Substation Feeder", "CRITICAL"),
            ("Section Insulator Unit", "HIGH"),
            ("Contact Wire Dropper Span", "MEDIUM"),
            ("Pantograph Clearance Sensor", "HIGH"),
            ("Neutral Section Assembly", "CRITICAL"),
            ("Return Current Bonding", "MEDIUM"),
            ("Overhead Catenary Cable", "HIGH"),
        ],
        "SIG": [
            ("Electric Point Machine 143mm", "CRITICAL"),
            ("Digital Axle Counter (Single/Multi)", "CRITICAL"),
            ("Audio Frequency Track Circuit (AFTC)", "HIGH"),
            ("4-Aspect Colour Light Signal", "HIGH"),
            ("Solid State Interlocking (SSI) Rack", "CRITICAL"),
            ("Failsafe Relay Group Unit", "HIGH"),
            ("Level Crossing Gate Interlocking", "CRITICAL"),
            ("Shunt Signal Aspect", "LOW"),
        ],
        "CIVIL": [
            ("60kg/m Rail Joint Fishplate", "CRITICAL"),
            ("PSC Sleeper Fastening Elastic Rail Clip", "HIGH"),
            ("Points and Crossing 1:12 Turnout", "CRITICAL"),
            ("Ballast Cushion Track Bed", "MEDIUM"),
            ("Rail Expansion Joint (SEJ)", "CRITICAL"),
            ("Track Gauge & Alignment Segment", "HIGH"),
            ("Major Railway Bridge Pier 4", "CRITICAL"),
            ("Level Crossing Road Surface Pavement", "LOW"),
        ],
        "TEL": [
            ("24-Core OFC Optical Fiber Node", "HIGH"),
            ("VHF Driver-Guard Communication Relay", "MEDIUM"),
            ("Emergency Control Phone Socket (EC)", "HIGH"),
            ("Passenger Information System (PIS) Display", "LOW"),
            ("Station Master Control Console Wiring", "HIGH"),
            ("Clock Master Synchronization Hub", "LOW"),
        ],
        "MECH": [
            ("Hot Axle Box Detection Sensor (HABD)", "CRITICAL"),
            ("Wheel Impact Load Detector (WILD)", "CRITICAL"),
            ("Carriage Watering Terminal Valve", "LOW"),
            ("Air Brake Testing Rig", "HIGH"),
        ]
    }

    assets = []
    for i in range(1, 401):
        dept_code = random.choice(["ELEC", "SIG", "CIVIL", "TEL", "MECH"])
        dept = dept_map[dept_code]
        atype, crit = random.choice(asset_types[dept_code])
        corr = random.choice(corridors[:50]) # concentrate on main corridors
        aid = f"{dept_code}-{atype.split()[0].upper()}-{i:03d}"
        status = random.choices(["HEALTHY", "DEGRADED", "FAULTY", "UNDER_MAINTENANCE"], weights=[70, 15, 10, 5])[0]
        a = Asset(
            asset_id=aid,
            name=f"{atype} #{i:03d}",
            department_id=dept.id,
            corridor_id=corr.id,
            station_id=corr.from_station_id,
            asset_type=atype,
            criticality=crit,
            status=status,
            install_year=random.randint(2015, 2024),
            last_inspected=f"2026-08-{random.randint(10, 31):02d}"
        )
        db.add(a)
        assets.append(a)
    db.flush()

    print("[INFO] Seeding 100 Manpower Crews and 100 Resources...")
    for i in range(1, 101):
        dept_code = random.choice(["ELEC", "SIG", "CIVIL", "TEL", "MECH"])
        dept = dept_map[dept_code]
        mp = Manpower(
            department_id=dept.id,
            gang_name=f"{dept_code} Section Maintenance Gang {i:02d}",
            crew_size=random.randint(4, 12),
            skill_level=random.choice(["Certified Technicians", "Senior Linesmen", "Specialist Welders", "Safety Marshals"]),
            available_count=random.randint(3, 10),
            contact_person=f"Supervisor Sharma {i}"
        )
        db.add(mp)

    res_types = [
        ("TOWER_WAGON", "Tower Inspection Wagon TW-", "ELEC"),
        ("TAMPING_MACHINE", "CSM 09-32 Tamping Machine TM-", "CIVIL"),
        ("CRANE", "140T Breakdown Rail Crane BC-", "MECH"),
        ("TEST_VAN", "Signalling Telemetry Test Van SV-", "SIG"),
        ("WELDING_KIT", "Alumino-Thermic Rail Welding Set WS-", "CIVIL"),
        ("CABLE_PULLER", "OFC Tensioner Cable Puller CP-", "TEL"),
    ]
    for i in range(1, 101):
        rtype, prefix, dept_code = random.choice(res_types)
        r = Resource(
            name=f"{prefix}{i:02d}",
            resource_type=rtype,
            department_id=dept_map[dept_code].id,
            status=random.choice(["AVAILABLE", "AVAILABLE", "IN_USE", "MAINTENANCE"]),
            location_station_id=random.choice(stations[:30]).id
        )
        db.add(r)
    db.flush()

    print("[INFO] Seeding 500 Train Schedules...")
    train_types = [
        ("RAJDHANI", "Rajdhani Express", 12951, "HIGH"),
        ("VANDE_BHARAT", "Vande Bharat Express", 22436, "HIGH"),
        ("SHATABDI", "Shatabdi Express", 12009, "HIGH"),
        ("SUPERFAST", "Superfast Express", 12414, "MEDIUM"),
        ("GOODS", "Freight BCN Container", 70123, "LOW"),
        ("GOODS", "Coal BOXN Rake", 70456, "LOW"),
        ("PASSENGER", "Intercity Passenger", 14318, "MEDIUM")
    ]
    trains = []
    for i in range(1, 501):
        ttype, tname, base_no, prio = random.choice(train_types)
        corr = random.choice(corridors[:60])
        dep_h = random.randint(0, 23)
        dep_m = random.choice([0, 15, 30, 45])
        arr_h = (dep_h + random.randint(1, 3)) % 24
        arr_m = random.choice([10, 25, 40, 55])
        t = TrainSchedule(
            train_no=f"{base_no + i}",
            train_name=f"{corr.from_station.name.split()[0]} - {corr.to_station.name.split()[0]} {tname}",
            train_type=ttype,
            corridor_id=corr.id,
            departure_time=f"{dep_h:02d}:{dep_m:02d}",
            arrival_time=f"{arr_h:02d}:{arr_m:02d}",
            frequency="Daily",
            priority=prio
        )
        db.add(t)
        trains.append(t)
    db.flush()

    print("[INFO] Seeding 200 Maintenance Requests (Consistent Demo Data)...")
    descriptions = {
        "ELEC": [
            "OHE Insulator Flashover and Flash mark repair on Mast 14/22",
            "Contact wire wear exceeding 20% limit - Urgent re-catenation needed",
            "Neutral section runner misalignment causing pantograph entangle risk",
            "Defective 25kV Isolator switch contacts overheating under peak load",
            "Traction transformer oil leakage and buchholz relay alarm check"
        ],
        "SIG": [
            "Point Machine 102 throwing erratic out-of-correspondence detection",
            "Digital Axle Counter track section false occupied indication",
            "Signal 4-aspect Red lamp filament burnout and LED aspect module replacement",
            "Track Circuit bonding failure due to rail corrosion after monsoon",
            "Interlocking route relay chattering in Relay Room Rack 4"
        ],
        "CIVIL": [
            "Ultrasonic Flaw Detection (USFD) confirmed severe rail fracture at Km 412/10",
            "Turnout 1:12 nose of crossing chipping requiring immediate weld building",
            "Track settlement and cross-level irregularity exceeding 15mm limit",
            "Loose fishplate bolts and worn out liner pads in curve section",
            "Deep ballast screening and track tamping required for 500m stretch"
        ],
        "TEL": [
            "OFC 24-core cable sheath damage during third-party excavation",
            "Emergency Control Phone circuit noisy and intermittent between stations",
            "VHF station base transceiver signal loss in tunnel section",
            "Electronic Passenger Information Board communication interface down"
        ],
        "MECH": [
            "Hot Box Detector alert on axle 3 of freight train rake 70123",
            "Wheel flat detected by WILD system exceeding 60mm condemning threshold"
        ]
    }

    requests = []
    # Specifically seed the prompt's reference requests:
    # PR-2026-00125 (Electrical OHE Insulator Fault, Station A -> Station B)
    ref_corr = corridors[0] # NDLS-GZB
    elec_asset = [a for a in assets if a.department_id == dept_map["ELEC"].id][0]
    sig_asset = [a for a in assets if a.department_id == dept_map["SIG"].id][0]
    tel_asset = [a for a in assets if a.department_id == dept_map["TEL"].id][0]
    civil_asset = [a for a in assets if a.department_id == dept_map["CIVIL"].id][0]

    # Reference Request 1: Electrical
    req1 = MaintenanceRequest(
        problem_id="PR-2026-00125",
        department_id=dept_map["ELEC"].id,
        corridor_id=ref_corr.id,
        from_station_id=ref_corr.from_station_id,
        to_station_id=ref_corr.to_station_id,
        asset_id=elec_asset.id,
        asset_criticality="HIGH",
        work_description="OHE Insulator Fault and contact wire spark wear inspection. Requires power de-energization.",
        manpower_required=6,
        manpower_available=6,
        resources_required="Tower Wagon TW-04, Grounding rods, High-voltage testing kit",
        safety_risk="HIGH",
        isolation_required=True,
        priority="HIGH",
        requested_date="2026-09-14",
        requested_start_time="02:00",
        requested_end_time="04:00",
        max_duration_hours=2.0,
        inspection_status="INSPECTED",
        inspection_remarks="Insulator glaze cracked, severe arcing risk in damp weather. Immediate replacement advised.",
        ai_priority="HIGH",
        ai_safety_risk="HIGH",
        ai_estimated_duration=2.0,
        ai_train_impact="LOW",
        status="APPROVED",
        reported_by_user_id=user_map["elec001"].id,
        progress_percent=0
    )
    db.add(req1)
    requests.append(req1)

    # Reference Request 2: Signal (Compatible for Block Fusion on same corridor!)
    req2 = MaintenanceRequest(
        problem_id="PR-2026-00126",
        department_id=dept_map["SIG"].id,
        corridor_id=ref_corr.id,
        from_station_id=ref_corr.from_station_id,
        to_station_id=ref_corr.to_station_id,
        asset_id=sig_asset.id,
        asset_criticality="HIGH",
        work_description="Point Machine 102 throwing detection failure. Needs internal motor clutch adjustment.",
        manpower_required=4,
        manpower_available=4,
        resources_required="Signalling Test Van SV-02, Point gauge set",
        safety_risk="MEDIUM",
        isolation_required=False,
        priority="HIGH",
        requested_date="2026-09-14",
        requested_start_time="02:00",
        requested_end_time="03:30",
        max_duration_hours=1.5,
        inspection_status="INSPECTED",
        inspection_remarks="Detection contacts showing wear. Requires 90 minutes track disconnection.",
        ai_priority="HIGH",
        ai_safety_risk="MEDIUM",
        ai_estimated_duration=1.5,
        ai_train_impact="LOW",
        status="APPROVED",
        reported_by_user_id=user_map["sig001"].id,
        progress_percent=0
    )
    db.add(req2)
    requests.append(req2)

    # Reference Request 3: Telecom (Compatible for Block Fusion!)
    req3 = MaintenanceRequest(
        problem_id="PR-2026-00127",
        department_id=dept_map["TEL"].id,
        corridor_id=ref_corr.id,
        from_station_id=ref_corr.from_station_id,
        to_station_id=ref_corr.to_station_id,
        asset_id=tel_asset.id,
        asset_criticality="MEDIUM",
        work_description="OFC Cable joint enclosure inspection and tension clamp adjustment along trackside trough.",
        manpower_required=3,
        manpower_available=4,
        resources_required="Optical OTDR Splicing Kit, Cable tension puller",
        safety_risk="LOW",
        isolation_required=False,
        priority="MEDIUM",
        requested_date="2026-09-14",
        requested_start_time="02:00",
        requested_end_time="03:30",
        max_duration_hours=1.5,
        inspection_status="INSPECTED",
        inspection_remarks="Attenuation spike detected on fibers 7 and 8. Preventive maintenance.",
        ai_priority="MEDIUM",
        ai_safety_risk="LOW",
        ai_estimated_duration=1.5,
        ai_train_impact="LOW",
        status="APPROVED",
        reported_by_user_id=user_map["tel001"].id,
        progress_percent=0
    )
    db.add(req3)
    requests.append(req3)

    # Reference Request 4: Civil (Critical Problem)
    req4 = MaintenanceRequest(
        problem_id="PR-2026-00128",
        department_id=dept_map["CIVIL"].id,
        corridor_id=corridors[2].id, # ALJN-TDL (Critical corridor)
        from_station_id=corridors[2].from_station_id,
        to_station_id=corridors[2].to_station_id,
        asset_id=civil_asset.id,
        asset_criticality="HIGH",
        work_description="Rail fracture detected by track gang. Immediate emergency fishplate clamping and joggled plate installation.",
        manpower_required=8,
        manpower_available=8,
        resources_required="Alumino-thermic weld kit, Hydraulic rail tensor, Tamping machine",
        safety_risk="HIGH",
        isolation_required=True,
        priority="CRITICAL",
        requested_date="2026-09-13",
        requested_start_time="01:30",
        requested_end_time="04:00",
        max_duration_hours=2.5,
        inspection_status="INSPECTED",
        inspection_remarks="Transverse fissure. Speed restriction 30 km/h imposed until block executed.",
        ai_priority="CRITICAL",
        ai_safety_risk="HIGH",
        ai_estimated_duration=2.5,
        ai_train_impact="HIGH",
        status="IN_PROGRESS",
        reported_by_user_id=user_map["civil001"].id,
        actual_start_time="01:35 AM",
        progress_percent=50
    )
    db.add(req4)
    requests.append(req4)

    # Reference Request 5: Completed with MCR awaiting verification
    req5 = MaintenanceRequest(
        problem_id="PR-2026-00005",
        department_id=dept_map["ELEC"].id,
        corridor_id=corridors[1].id,
        from_station_id=corridors[1].from_station_id,
        to_station_id=corridors[1].to_station_id,
        asset_id=assets[10].id,
        asset_criticality="HIGH",
        work_description="25kV Substation Feeder Circuit Breaker contact resistance test and gas pressure calibration.",
        manpower_required=5,
        manpower_available=5,
        resources_required="SF6 Gas Kit, Contact Resistance Meter",
        safety_risk="HIGH",
        isolation_required=True,
        priority="HIGH",
        requested_date="2026-09-12",
        requested_start_time="01:00",
        requested_end_time="03:00",
        max_duration_hours=2.0,
        inspection_status="INSPECTED",
        inspection_remarks="SF6 pressure slightly below nominal threshold. Completed successfully.",
        ai_priority="HIGH",
        ai_safety_risk="HIGH",
        ai_estimated_duration=2.0,
        ai_train_impact="LOW",
        status="MCR_SUBMITTED",
        reported_by_user_id=user_map["elec001"].id,
        actual_start_time="01:05 AM",
        progress_percent=100
    )
    db.add(req5)
    requests.append(req5)

    # Populate remaining requests to reach 200 without collision
    statuses = [
        "NEW", "NEW", "INSPECTED", "AI_ANALYZED", "APPROVED", "APPROVED", 
        "IN_PROGRESS", "DELAYED", "MCR_SUBMITTED", "VERIFIED", "CLOSED", "REWORK"
    ]
    used_pids = {r.problem_id for r in requests}
    curr_id = 10
    while len(requests) < 200:
        pid = f"PR-2026-{curr_id:05d}"
        curr_id += 1
        if pid in used_pids:
            continue
        used_pids.add(pid)
        dept_code = random.choice(["ELEC", "SIG", "CIVIL", "TEL", "MECH"])
        dept = dept_map[dept_code]
        corr = random.choice(corridors[:40])
        corr_assets = [a for a in assets if a.corridor_id == corr.id and a.department_id == dept.id]
        chosen_asset = corr_assets[0] if corr_assets else random.choice(assets)
        st = random.choice(statuses)
        prio = random.choice(["CRITICAL", "HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW"])
        dur = random.choice([1.0, 1.5, 2.0, 2.5, 3.0])
        
        req = MaintenanceRequest(
            problem_id=pid,
            department_id=dept.id,
            corridor_id=corr.id,
            from_station_id=corr.from_station_id,
            to_station_id=corr.to_station_id,
            asset_id=chosen_asset.id,
            asset_criticality=chosen_asset.criticality,
            work_description=random.choice(descriptions[dept_code]),
            manpower_required=random.randint(3, 8),
            manpower_available=random.randint(3, 8),
            resources_required=f"Standard {dept_code} Toolkit and Safety Harness",
            safety_risk=random.choice(["HIGH", "MEDIUM", "LOW"]),
            isolation_required=(dept_code == "ELEC" or prio == "CRITICAL"),
            priority=prio,
            requested_date=f"2026-09-{random.randint(10, 25):02d}",
            requested_start_time=f"{random.randint(1, 4):02d}:00",
            requested_end_time=f"{random.randint(3, 6):02d}:00",
            max_duration_hours=dur,
            inspection_status="INSPECTED",
            inspection_remarks="Field inspection carried out by Section Supervisor.",
            ai_priority=prio,
            ai_safety_risk="HIGH" if prio == "CRITICAL" else "MEDIUM",
            ai_estimated_duration=dur,
            ai_train_impact="HIGH" if prio == "CRITICAL" else "LOW",
            status=st,
            reported_by_user_id=user_map.get(f"{dept_code.lower()}001", user_map["elec001"]).id,
            progress_percent=100 if st in ["MCR_SUBMITTED", "VERIFIED", "CLOSED"] else (50 if st == "IN_PROGRESS" else 0),
            delay_reason="Equipment arrival delay" if st == "DELAYED" else None,
            delay_remarks="Heavy rain delayed crane deployment by 40 minutes" if st == "DELAYED" else None,
            reject_reason="Overlaps with Vande Bharat Express slot. Resubmit for 03:00 AM window." if st == "REJECTED" else None,
            rework_remarks="Fasteners torque test values not recorded in test report. Re-inspect." if st == "REWORK" else None
        )
        db.add(req)
        requests.append(req)
    db.flush()

    print("[INFO] Seeding Reference Maintenance Block B-102 with Block Fusion (Electrical + Signal + Telecom)...")
    # Prompt explicitly specifies Block B-102 on Corridor A -> B combining 3 jobs!
    b102 = MaintenanceBlock(
        block_id="B-102",
        corridor_id=ref_corr.id,
        start_time="02:30 AM",
        end_time="04:30 AM",
        duration_hours=2.0,
        status="APPROVED",
        safety_clearance=True,
        isolation_type="25kV OHE Power Block + Track Circuit Disconnection",
        train_impact="LOW",
        notes="Combined multi-department maintenance block. Electrical OHE Insulator + Signal Point Machine + Telecom OFC Cable.",
        approved_by_user_id=user_map["hod001"].id,
        approved_at=datetime.datetime.utcnow() - datetime.timedelta(hours=4)
    )
    db.add(b102)
    db.flush()

    # Link jobs to B-102
    db.add(BlockJob(block_id=b102.id, request_id=req1.id, job_order=1))
    db.add(BlockJob(block_id=b102.id, request_id=req2.id, job_order=2))
    db.add(BlockJob(block_id=b102.id, request_id=req3.id, job_order=3))

    # AI Recommendation for B-102
    ai_rec = AIRecommendation(
        block_id=b102.id,
        title="Optimal Block Fusion: 3 Compatible Jobs Combined",
        rationales=[
            "No train conflict (Shifted window to 02:30 AM to let 12951 Rajdhani pass at 02:15 AM)",
            "Compatible departments (Electrical + Signal + Telecom share same corridor)",
            "Required manpower available (13 technicians total within regional gang ceiling)",
            "Shared Tower Wagon and safety grounding resources fully coordinated",
            "OHE power shutoff utilized simultaneously by Signal and Telecom",
            "Reduced number of blocks from 3 separate blocks down to 1 consolidated block",
            "Estimated block reduction: 66.7%",
            "Higher asset availability restored for dawn passenger traffic"
        ],
        block_reduction_percent=66.7,
        train_delay_mitigation_minutes=60,
        asset_availability_impact=96.4
    )
    db.add(ai_rec)

    print("[INFO] Seeding 50 Maintenance Blocks across corridors...")
    for i in range(1, 50):
        corr = random.choice(corridors[:30])
        status = random.choice(["AI_RECOMMENDED", "APPROVED", "ACTIVE", "COMPLETED", "PENDING"])
        blk = MaintenanceBlock(
            block_id=f"B-{102+i:03d}",
            corridor_id=corr.id,
            start_time=f"{random.randint(1, 3):02d}:30 AM",
            end_time=f"{random.randint(3, 5):02d}:30 AM",
            duration_hours=2.0,
            status=status,
            safety_clearance=True,
            isolation_type=random.choice(["OHE Power Block", "Track Circuit Disconnection", "Complete Traffic & Power Block"]),
            train_impact="LOW" if status == "APPROVED" else "MEDIUM",
            notes=f"Maintenance window for {corr.name}",
            approved_by_user_id=user_map["hod001"].id if status in ["APPROVED", "COMPLETED", "ACTIVE"] else None,
            approved_at=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(1, 5)) if status in ["APPROVED", "COMPLETED"] else None
        )
        db.add(blk)
        db.flush()
        
        # Associate 1 or 2 requests with this block
        cand_reqs = [r for r in requests if r.corridor_id == corr.id and r.id not in [req1.id, req2.id, req3.id]]
        if cand_reqs:
            for idx, cr in enumerate(cand_reqs[:2]):
                db.add(BlockJob(block_id=blk.id, request_id=cr.id, job_order=idx+1))

    print("[INFO] Seeding Operational Conflicts (Train, Corridor, Manpower, etc.)...")
    # Prompt explicit conflict: Train 12951 passes during proposed 02:00 block
    train_12951 = [t for t in trains if "12951" in t.train_no]
    train_obj = train_12951[0] if train_12951 else trains[0]
    
    c1 = Conflict(
        conflict_type="TRAIN",
        severity="CRITICAL",
        title="Train Collision Hazard with 12951 Rajdhani Express",
        description=f"Train 12951 passes corridor {ref_corr.name} at 02:15 AM during proposed 02:00–04:00 maintenance block.",
        corridor_id=ref_corr.id,
        block_id=b102.id,
        request_id=req1.id,
        train_id=train_obj.id,
        ai_suggestion="Shift block start window from 02:00 AM to 02:30 AM (after 12951 Rajdhani clears block section).",
        is_resolved=True,
        resolved_at=datetime.datetime.utcnow()
    )
    db.add(c1)

    c2 = Conflict(
        conflict_type="MANPOWER",
        severity="WARNING",
        title="Simultaneous Gang Shortage in Prayagraj Division",
        description="Electrical gang capacity exceeded by 2 simultaneous jobs on adjacent sections.",
        corridor_id=corridors[2].id,
        ai_suggestion="Sequenced execution: staggered start with 45-minute separation.",
        is_resolved=False
    )
    db.add(c2)

    c3 = Conflict(
        conflict_type="ISOLATION",
        severity="CRITICAL",
        title="Traction Power Isolation Boundary Conflict",
        description="Overlapping section insulator feed boundary requires traction feeder isolation across both Up and Down lines.",
        corridor_id=corridors[3].id,
        ai_suggestion="Execute combined power block with Traction Power Controller (TPC) clearance.",
        is_resolved=False
    )
    db.add(c3)

    c4 = Conflict(
        conflict_type="RESOURCE",
        severity="WARNING",
        title="Tower Wagon TW-04 Contention",
        description="TW-04 requested simultaneously by OHE Inspection and Feeder Repair teams.",
        corridor_id=ref_corr.id,
        ai_suggestion="Utilize Block Fusion to combine OHE Inspection and Feeder Repair into one continuous run.",
        is_resolved=True,
        resolved_at=datetime.datetime.utcnow()
    )
    db.add(c4)

    print("[INFO] Seeding Reference MCR Report...")
    # Seed MCR for req5 (Awaiting verification)
    mcr1 = MCRReport(
        mcr_id="MCR-2026-00045",
        request_id=req5.id,
        department_id=dept_map["ELEC"].id,
        corridor_id=corridors[1].id,
        asset_id=assets[10].id,
        actual_work_performed="SF6 Gas refilling completed to 5.5 bar nominal pressure. Circuit breaker dynamic resistance measured at 42 micro-ohms (within 50 micro-ohm spec). All control wirings and trip coils functionally checked.",
        work_status="Completed",
        manpower_deployed=5,
        resources_used="SF6 Gas Kit, Contact Resistance Meter, High-Voltage Discharge Rod",
        actual_start_time="01:05 AM",
        actual_completion_time="02:42 AM",
        actual_duration_hours=1.62,
        planned_commitment_hours=2.0,
        commitment_met=True,
        safety_clearance=True,
        asset_restored="YES",
        supporting_docs=[
            {"name": "SF6_Pressure_Calibration_Certificate.pdf", "size": "1.2 MB", "type": "pdf"},
            {"name": "Breaker_Contact_Resistance_Log.png", "size": "840 KB", "type": "image"},
            {"name": "Work_Completion_Site_Photo.jpg", "size": "2.4 MB", "type": "image"}
        ],
        verification_status="AWAITING_VERIFICATION"
    )
    db.add(mcr1)

    # Seed an MCR that is CLOSED
    req_closed = [r for r in requests if r.status == "CLOSED"][0]
    mcr2 = MCRReport(
        mcr_id="MCR-2026-00012",
        request_id=req_closed.id,
        department_id=req_closed.department_id,
        corridor_id=req_closed.corridor_id,
        asset_id=req_closed.asset_id,
        actual_work_performed="Routine turnout lubrication and stretcher bar bolt tightening completed. Gauge variation adjusted to +1mm.",
        work_status="Completed",
        manpower_deployed=4,
        resources_used="Standard Track Toolkit",
        actual_start_time="02:00 AM",
        actual_completion_time="03:30 AM",
        actual_duration_hours=1.5,
        planned_commitment_hours=2.0,
        commitment_met=True,
        safety_clearance=True,
        asset_restored="YES",
        supporting_docs=[],
        verification_status="CLOSED",
        verified_by_user_id=user_map["hod001"].id,
        verified_at=datetime.datetime.utcnow() - datetime.timedelta(days=2)
    )
    db.add(mcr2)

    # Seed an MCR that was sent for REWORK
    req_rework = [r for r in requests if r.status == "REWORK"][0]
    mcr3 = MCRReport(
        mcr_id="MCR-2026-00028",
        request_id=req_rework.id,
        department_id=req_rework.department_id,
        corridor_id=req_rework.corridor_id,
        asset_id=req_rework.asset_id,
        actual_work_performed="Replaced fishplates on Up line Km 312.",
        work_status="Partially Completed",
        manpower_deployed=3,
        resources_used="Torque Wrench",
        actual_start_time="01:30 AM",
        actual_completion_time="03:45 AM",
        actual_duration_hours=2.25,
        planned_commitment_hours=2.0,
        commitment_met=False,
        delay_reason="Shortage of standard 25mm high-tensile bolts on site.",
        safety_clearance=False,
        asset_restored="PARTIALLY",
        supporting_docs=[],
        verification_status="REWORK",
        rework_instructions="Torque testing certificates missing. Fasteners must be re-torqued to 550 Nm with calibrated gauge before safety clearance can be granted.",
        verified_by_user_id=user_map["hod001"].id,
        verified_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    db.add(mcr3)

    print("[INFO] Seeding Notifications & Audit Logs...")
    notifs = [
        ("Block B-102 approved by Higher HOD", "Combined block for Electrical, Signal, Telecom approved for 02:30 AM window.", "SUCCESS", "LOWER_HOD", dept_map["ELEC"].id),
        ("Critical Rail Fracture on ALJN-TDL", "Emergency speed restriction 30 km/h imposed. Emergency maintenance team dispatched.", "CRITICAL", "ALL", None),
        ("MCR MCR-2026-00045 awaiting verification", "Electrical department submitted completion report for Feeder Circuit Breaker.", "INFO", "HIGHER_HOD", None),
        ("Maintenance commitment approaching", "PR-2026-00128 has reached 50% duration. Target completion: 04:00 AM.", "WARNING", "LOWER_HOD", dept_map["CIVIL"].id),
        ("MCR-2026-00028 sent for Rework", "Higher HOD requested torque re-inspection for fishplate fasteners.", "WARNING", "LOWER_HOD", req_rework.department_id),
    ]
    for title, msg, atype, role, dept_id in notifs:
        n = Notification(
            role=role,
            department_id=dept_id,
            title=title,
            message=msg,
            alert_type=atype,
            is_read=False
        )
        db.add(n)

    audit_entries = [
        (user_map["hod001"].id, "Keval Rana", "HIGHER_HOD", "APPROVE_BLOCK", "BLOCK", "B-102", "Approved Block B-102 combining PR-2026-00125, PR-2026-00126, and PR-2026-00127."),
        (user_map["elec001"].id, "Rahul Patel", "LOWER_HOD", "CREATE_REQUEST", "REQUEST", "PR-2026-00125", "Created maintenance problem report for OHE Insulator Fault."),
        (user_map["elec001"].id, "Rahul Patel", "LOWER_HOD", "START_WORK", "REQUEST", "PR-2026-00110", "Recorded actual work start at 01:05 AM."),
        (user_map["elec001"].id, "Rahul Patel", "LOWER_HOD", "SUBMIT_MCR", "MCR", "MCR-2026-00045", "Submitted Maintenance Completion Report for Feeder Breaker."),
        (user_map["hod001"].id, "Keval Rana", "HIGHER_HOD", "SEND_REWORK_MCR", "MCR", "MCR-2026-00028", "Sent MCR back for rework: Missing torque testing certificates."),
        (user_map["civil001"].id, "Rajesh Sharma", "LOWER_HOD", "REPORT_DELAY", "REQUEST", "PR-2026-00030", "Reported delay: Heavy rain delayed crane deployment."),
    ]
    for uid, uname, role, act, etype, eid, det in audit_entries:
        db.add(AuditLog(
            user_id=uid,
            user_name=uname,
            role=role,
            action=act,
            entity_type=etype,
            entity_id=eid,
            details=det
        ))

    # Emergency Event
    em = EmergencyEvent(
        event_id="EMG-2026-001",
        corridor_id=corridors[2].id,
        asset_id=civil_asset.id,
        title="Unscheduled Rail Fracture Detected by Track Gang",
        description="Severe fracture detected at Km 412/10. Train movement halted on Up line. Immediate emergency block required.",
        severity="CRITICAL",
        status="ACTIVE",
        ai_plan_suggested="Create Emergency Block EB-901 for 02:00–04:00 AM. Divert Goods Freight 70123 via loop line."
    )
    db.add(em)

    db.commit()
    db.close()
    print("[SUCCESS] Indian Railways Synthetic Dataset Seeded Successfully!")
    print("           - 70 Stations")
    print("           - 200 Corridors")
    print("           - 400 Fixed Infrastructure Assets")
    print("           - 500 Train Schedules")
    print("           - 200 Maintenance Requests")
    print("           - 100 Manpower Crews & 100 Equipment Resources")
    print("           - 50 Maintenance Blocks (including Block B-102)")
    print("           - Realistic Conflicts, AI Recommendations, MCRs, Audit Logs, and Notifications")

if __name__ == "__main__":
    seed_database()
