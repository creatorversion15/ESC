import { collection, doc, getDocs, setDoc, query, limit } from 'firebase/firestore';
import { db } from './firebase';
import type { ProblemStatement, Project, StartupIdea, CertificateRecord } from '../types';

export const INITIAL_PROBLEMS: Omit<ProblemStatement, 'id'>[] = [
  {
    title: 'Decentralized Microgrid Load Balancing for Rural Agricultural Feeders',
    description: 'During irrigation seasons, unscheduled high inductive motor loads cause severe frequency fluctuations and grid collapse in rural substations. We need an autonomous IoT-mesh load-shifting controller that negotiates solar pump activation based on real-time feeder stress without human dispatchers.',
    industry: 'CleanTech & Energy',
    difficulty: 'advanced',
    status: 'open',
    skillsRequired: ['Embedded C', 'Power Electronics', 'LoRaWAN', 'Control Theory'],
    interestCount: 18,
    interestedUserIds: [],
    authorId: 'admin_esc',
    authorName: 'ESC Engineering Council',
    verifiedByAdmin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'Low-Cost Optical Spectroscopy for Micro-Plastic Contamination in Tap Water',
    description: 'Municipal water testing labs rely on multi-thousand dollar Raman spectrometers. Develop an open-source optical absorption flow cell utilizing multi-wavelength UV-NIR LEDs and photodiode arrays capable of detecting PET/HDPE particles down to 20 microns at point-of-use.',
    industry: 'Environmental & Hardware',
    difficulty: 'advanced',
    status: 'team_formation',
    skillsRequired: ['Spectroscopy', 'Optoelectronics', 'PCB Design', 'Python DSP'],
    interestCount: 24,
    interestedUserIds: [],
    authorId: 'admin_esc',
    authorName: 'Prof. Anirudh Sen, ESC Advisory',
    verifiedByAdmin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'Edge AI Diagnostic Module for Primary Health Centers (Offline Inference)',
    description: 'Rural healthcare clinics lack radiologist coverage and stable broadband. Build a sub-15W edge accelerator (e.g. Coral/RK3588) running quantized vision transformers for automated chest X-ray consolidation screening and tuberculosis risk scoring.',
    industry: 'MedTech & AI',
    difficulty: 'intermediate',
    status: 'open',
    skillsRequired: ['PyTorch', 'TensorRT', 'Model Quantization', 'FastAPI', 'DICOM'],
    interestCount: 31,
    interestedUserIds: [],
    authorId: 'admin_esc',
    authorName: 'Dr. V. Ramanathan, MedAI Fellow',
    verifiedByAdmin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'Modular Regenerative Braking Unit for Fleet Electric 2-Wheelers',
    description: 'Delivery two-wheelers waste 28% of kinetic energy in stop-and-go urban traffic. Design an aftermarket ultracapacitor-buffered buck-boost regenerative controller compatible with standard 48V/60V BLDC hub motors.',
    industry: 'EV & Automotive',
    difficulty: 'intermediate',
    status: 'in_progress',
    skillsRequired: ['BLDC Motor Control', 'Ultracapacitors', 'CAN Bus', 'Thermal Management'],
    interestCount: 15,
    interestedUserIds: [],
    authorId: 'admin_esc',
    authorName: 'ESC EV Working Group',
    verifiedByAdmin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_PROJECTS: Omit<Project, 'id'>[] = [
  {
    title: 'SolAura — Autonomous Agri-Inspection Drone Swarm',
    description: 'Autonomous multi-rotor drone system coordinating synchronized flights over orchard canopy to detect early pest infestation and nitrogen deficiency using multispectral imaging.',
    category: 'Robotics & Mechatronics',
    leaderId: 'esc_builder_1',
    leaderName: 'Kavya Deshmukh',
    objectives: [
      'Design sub-1.8kg carbon fiber quadcopter with 42min endurance',
      'Implement RTK-GPS centimeter precision formation flight',
      'Train onboard YOLOv11 nano model for rust leaf detection',
    ],
    requiredSkills: ['PX4 / ArduPilot', 'ROS2', 'Computer Vision', 'Carbon Fiber Fab'],
    teamMemberIds: ['esc_builder_1', 'esc_builder_2'],
    teamMembers: [
      { id: 'esc_builder_1', name: 'Kavya Deshmukh', role: 'Avionics & Flight Software' },
      { id: 'esc_builder_2', name: 'Taranjeet Singh', role: 'Airframe & Structural CAE' },
    ],
    status: 'in_progress',
    demoUrl: 'https://github.com/esc-community/solaura-swarm',
    repoUrl: 'https://github.com/esc-community/solaura-swarm',
    milestones: [
      { id: 'm1', title: 'Single Drone Autonomous Waypoint Navigation', targetDate: '2026-12-01', completed: true },
      { id: 'm2', title: 'Multispectral NDVI Pipeline Benchmark', targetDate: '2026-12-20', completed: true },
      { id: 'm3', title: '3-Drone Synchronized Swarm Field Run', targetDate: '2027-01-15', completed: false },
    ],
    tasks: [
      { id: 't1', title: 'Calibrate optical flow camera under varying sunlight', completed: true },
      { id: 't2', title: 'Integrate LoRa telemetry fail-safe heartbeat', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'BionicGrip — Myoelectric Prosthetic Arm with Haptic Telemetry',
    description: '3D-printed transradial bionic prosthesis with individual finger articulation driven by 4-channel surface EMG sensor arrays and vibrotactile grip feedback for amputees.',
    category: 'Biomedical & Hardware',
    leaderId: 'esc_builder_3',
    leaderName: 'Aditya Verma',
    objectives: [
      'Fabricate lightweight SLS nylon hand weighing under 420 grams',
      'Achieve 6 distinct grip patterns using active pattern recognition',
      'Reduce total BOM cost to under ₹18,000 (~$220 USD)',
    ],
    requiredSkills: ['Biomedical Signals', 'SolidWorks', 'STM32 Microcontrollers', 'Analog Filters'],
    teamMemberIds: ['esc_builder_3'],
    teamMembers: [
      { id: 'esc_builder_3', name: 'Aditya Verma', role: 'Project Lead & Mechatronics' },
    ],
    status: 'recruiting',
    demoUrl: '',
    repoUrl: 'https://github.com/esc-community/bionic-grip',
    milestones: [
      { id: 'm1', title: 'EMG analog front-end 4-stage filter design', targetDate: '2026-11-25', completed: true },
      { id: 'm2', title: 'Tendon tensioning cable linkage assembly', targetDate: '2026-12-10', completed: false },
    ],
    tasks: [
      { id: 't1', title: 'Test 24-bit ADC noise immunity near DC motors', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'CryoLogix — Phase-Change Autonomous Cold Chain Carrier',
    description: 'Solar-assisted thermal storage pod maintaining ultra-stable 2°C to 8°C temperature without heavy compressor mechanics for last-mile biological sample logistics.',
    category: 'CleanTech & Thermodynamics',
    leaderId: 'esc_builder_4',
    leaderName: 'Sneha Roy',
    objectives: [
      'Maintain 72-hour autonomous thermal envelope in 45°C ambient',
      'Cellular IoT continuous temperature logging with blockchain tamper seal',
      'Lightweight ergonomic backpack chassis for remote terrain',
    ],
    requiredSkills: ['Thermal Engineering', 'Phase Change Materials', 'Nordic nRF9160', 'Industrial Design'],
    teamMemberIds: ['esc_builder_4'],
    teamMembers: [
      { id: 'esc_builder_4', name: 'Sneha Roy', role: 'Thermal Architect' },
    ],
    status: 'in_progress',
    demoUrl: '',
    repoUrl: 'https://github.com/esc-community/cryo-logix',
    milestones: [
      { id: 'm1', title: 'PCM thermal cycling longevity verification (100 cycles)', targetDate: '2026-11-30', completed: true },
      { id: 'm2', title: 'Field trial with regional veterinary vaccine drive', targetDate: '2026-12-28', completed: false },
    ],
    tasks: [
      { id: 't1', title: 'Finalize vacuum insulation panel gasket seals', completed: true },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_IDEAS: Omit<StartupIdea, 'id'>[] = [
  {
    title: 'HyperKite: High-Altitude Airborne Wind Energy System',
    problemStatement: 'Conventional ground-based wind turbines are constrained to low-altitude turbulent air and require hundreds of tons of concrete and steel.',
    targetAudience: 'Off-grid mining sites, remote island communities, and disaster relief camps.',
    proposedSolution: 'Tethered carbon-composite autonomous gliders flying crosswind trajectories at 400m altitude, transmitting mechanical torque to a ground winch generator.',
    industry: 'CleanTech & Renewable Energy',
    uniqueValueProposition: 'Produces 4x higher capacity factor with 85% less material mass than conventional wind towers.',
    stage: 'prototype',
    demoUrl: 'https://youtu.be/esc-hyperkite-testflight',
    skillsRequired: ['Aerospace Dynamics', 'Tether Mechanics', 'Reinforcement Learning', 'Power Generators'],
    teamRequirements: 'Looking for a CFD aerodynamicist and a high-voltage electrical engineer.',
    fundingRequirements: 'Seeking ₹15,00,000 for full-scale 5kW generator field test.',
    isPublic: true,
    authorId: 'esc_idea_1',
    authorName: 'Rohan Shinde',
    authorEmail: 'rohan.aero@esc.community',
    reviewStatus: 'approved',
    adminFeedback: 'Outstanding technical rigor. Approved for ESC showcase and investor intro track.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'NeuroSift: Real-Time Audio Spatializer ASIC for Cochlear Implants',
    problemStatement: 'Current cochlear implant processors struggle with the "cocktail party effect", leaving users fatigued in crowded environments.',
    targetAudience: 'Over 60 million individuals worldwide with severe bilateral sensorineural hearing loss.',
    proposedSolution: 'Ultra-low-power sub-1mW mixed-signal neuromorphic ASIC implementing spatial beamforming and auditory attention decoding.',
    industry: 'DeepTech & Semiconductors',
    uniqueValueProposition: 'Real-time noise isolation with sub-4ms latency, directly compatible with implant electrode arrays.',
    stage: 'research',
    demoUrl: '',
    skillsRequired: ['VLSI Design', 'Audio DSP', 'Neuromorphic Computing', 'Verilog'],
    teamRequirements: 'Need a biomedical engineer familiar with neural stimulation safety standards.',
    fundingRequirements: 'Seed grant for MPW silicon tape-out fabrication.',
    isPublic: true,
    authorId: 'esc_idea_2',
    authorName: 'Meera Iyer',
    authorEmail: 'meera.vlsi@esc.community',
    reviewStatus: 'approved',
    adminFeedback: 'Phenomenal problem scope. ESC Mentor Dr. Sengupta has been assigned to support ASIC simulation.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    title: 'WeldVision: In-Situ Defect Prediction for Robotic MIG Welding',
    problemStatement: 'Automotive and shipbuilding manufacturers lose millions annually in post-weld ultrasonic rejection and thermal rework.',
    targetAudience: 'Tier-1 tier-2 automotive tier suppliers, structural steel fabricators.',
    proposedSolution: 'Coaxial high-speed thermal vision camera integrated directly into welding torches, running CNNs that detect porosity and burn-through in real time.',
    industry: 'Industrial Automation & AI',
    uniqueValueProposition: 'Corrects robotic torch angle and wire-feed speed mid-weld in under 12 milliseconds.',
    stage: 'mvp',
    demoUrl: 'https://weldvision.tech',
    skillsRequired: ['PyTorch', 'ROS', 'High-Speed Vision', 'Thermal Imaging'],
    teamRequirements: 'Looking for industrial sales lead and PLC automation engineer.',
    fundingRequirements: 'Bootstrapped, seeking pilot manufacturing deployments.',
    isPublic: true,
    authorId: 'esc_idea_3',
    authorName: 'Kunal Patil',
    authorEmail: 'kunal.robotics@esc.community',
    reviewStatus: 'approved',
    adminFeedback: 'Verified industrial prototype. Showcase approved.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_CERTIFICATES: Omit<CertificateRecord, 'id'>[] = [
  {
    certId: 'ESC-2026-HW01',
    studentId: 'ESC-STU-8821',
    studentName: 'Alex Rivera',
    studentEmail: 'alex.rivera@engineering.edu',
    activityName: 'ESC DeepTech Prototyping Fellowship 2026 — Advanced Autonomous Systems Track',
    organization: 'Engineering Startup Company (ESC)',
    issueDate: 'October 28, 2026',
    authorizedSigner: 'Dr. Vikram Malhotra',
    authorizedSignerTitle: 'Chief Innovation Officer & Founding Trustee, ESC',
    verificationHash: 'ESC-7A4B9F2E',
    status: 'valid',
    createdAt: new Date().toISOString(),
  },
  {
    certId: 'ESC-2026-BD42',
    studentId: 'ESC-STU-4190',
    studentName: 'Priya Sharma',
    studentEmail: 'priya.s@techuniv.edu',
    activityName: 'ESC National Buildathon 2026 — 1st Place CleanTech Innovation',
    organization: 'Engineering Startup Company (ESC)',
    issueDate: 'November 05, 2026',
    authorizedSigner: 'Ananya Deshmukh',
    authorizedSignerTitle: 'Student President, Engineering Startup Company',
    verificationHash: 'ESC-9C1D3A88',
    status: 'valid',
    createdAt: new Date().toISOString(),
  },
];

/**
 * Checks if core non-admin-restricted collections are empty and seeds initial engineering content.
 * Note: Challenges, Events, and Opportunities are NEVER seeded automatically and remain 100% Super Admin controlled.
 */
export async function seedInitialDataIfNeeded() {
  try {
    // 1. Problems
    const problemsCol = collection(db, 'problems');
    const problemSnap = await getDocs(query(problemsCol, limit(1)));
    if (problemSnap.empty) {
      for (const item of INITIAL_PROBLEMS) {
        const ref = doc(problemsCol);
        await setDoc(ref, item);
      }
    }

    // 2. Projects
    const projectsCol = collection(db, 'projects');
    const projectSnap = await getDocs(query(projectsCol, limit(1)));
    if (projectSnap.empty) {
      for (const item of INITIAL_PROJECTS) {
        const ref = doc(projectsCol);
        await setDoc(ref, item);
      }
    }

    // 3. Ideas
    const ideasCol = collection(db, 'ideas');
    const ideaSnap = await getDocs(query(ideasCol, limit(1)));
    if (ideaSnap.empty) {
      for (const item of INITIAL_IDEAS) {
        const ref = doc(ideasCol);
        await setDoc(ref, item);
      }
    }

    // 4. Certificates
    const certsCol = collection(db, 'certificates');
    const certSnap = await getDocs(query(certsCol, limit(1)));
    if (certSnap.empty) {
      for (const item of INITIAL_CERTIFICATES) {
        const ref = doc(certsCol, item.certId);
        await setDoc(ref, item);
      }
    }
  } catch (error) {
    // Log seeding error non-fatally
    console.warn('Seed database notice (may need permissions if unauthenticated):', error);
  }
}
