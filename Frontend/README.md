# Traffic Signal Management Dashboard

A real-time traffic signal management system with role-based access control, emergency override capabilities, and AI-powered traffic optimization.

## Features

- **Real-time Traffic Monitoring**: Live updates of traffic density, vehicle counts, and signal timers across 4 lanes
- **Role-based Access Control**: Separate interfaces for regular users and traffic officials
- **Emergency Override**: Immediate emergency response capabilities for officials
- **AI Training**: Reinforcement learning agent training for traffic optimization
- **Predictive Analytics**: Traffic flow predictions with statistical analysis
- **Manual Takeover**: Officials can manually control specific lanes
- **Alert System**: Real-time alerts for system anomalies

## Quick Start

### Prerequisites

- Node.js 18+ 
- Python Flask backend running on port 5000
- Modern web browser

### Installation

1. **Download the project files**
   \`\`\`bash
   # Download ZIP from v0 or clone from GitHub
   cd traffic-dashboard
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Backend Setup

Ensure your Flask backend is running on port 5000. The backend should expose the following endpoints:
- Authentication: `/auth/login`, `/auth/signup`
- Traffic data: `/api/traffic_data`
- Controls: `/api/emergency`, `/api/pedestrian`, `/api/set_mode`
- Official endpoints: `/official/takeover`, `/official/prediction`, `/alerts`

## Demo Script (1 minute)

### Step 1: Sign Up & Login (15 seconds)
1. Click "Sign Up" in the top-right corner
2. Create account: username `demo_user`, password `demo123`
3. Switch to "Login" and sign in

### Step 2: Monitor Traffic (15 seconds)
1. Observe real-time lane data updating every second
2. Notice traffic lights, density percentages, and sparkline charts
3. Try changing polling interval to 0.5s or 2s

### Step 3: User Actions (15 seconds)
1. Click pedestrian request buttons for different lanes
2. Toggle mock mode on/off
3. Watch the system mode badge change

### Step 4: Official Features (15 seconds)
1. Logout and login as `gov_officer2` with password `pass1234`
2. Notice the "Official" badge and additional controls
3. Try manual takeover: select lane 2, duration 30s, click "Take Control"
4. Activate emergency mode using the red Emergency button

## Test Accounts

- **Regular User**: Create your own account via signup
- **Official Account**: `gov_officer2` / `pass1234` (pre-created by backend)

## Architecture

### Frontend Components
- **AuthPanel**: User authentication and role management
- **TrafficDashboard**: Main dashboard layout and real-time polling
- **LaneVisualizer**: Traffic light visualization with countdown timers
- **OfficialPanel**: Advanced controls for traffic officials
- **EmergencyModal**: Emergency override interface

### Key Features
- **Real-time Polling**: Configurable intervals (0.5s, 1s, 2s)
- **Sparkline Charts**: Historical traffic data visualization
- **Countdown Rings**: Visual countdown for active traffic signals
- **Responsive Design**: Mobile-friendly layout
- **Error Handling**: Graceful handling of connection issues and auth errors

## Backend Caveats

**Important**: This is a hackathon demo with the following limitations:
- **CSV Password Storage**: User credentials are stored in plain CSV files, not encrypted
- **In-Memory Sessions**: Session tokens are stored in memory and will be lost on server restart
- **No Production Security**: Missing proper authentication, HTTPS, rate limiting, and other production security measures

This system is designed for demonstration purposes only and should not be used in production environments without significant security enhancements.

## Development

### Project Structure
\`\`\`
├── app/
│   ├── page.tsx          # Main application entry
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles with traffic theme
├── components/
│   ├── auth-panel.jsx    # Authentication interface
│   ├── traffic-dashboard.jsx # Main dashboard
│   ├── lane-visualizer.jsx   # Traffic visualization
│   ├── official-panel.jsx    # Official controls
│   ├── user-controls.jsx     # User actions
│   └── emergency-modal.jsx   # Emergency interface
├── hooks/
│   └── use-traffic.js    # Real-time data polling hook
├── lib/
│   └── auth.js          # Authentication utilities
└── README.md
\`\`\`

### Customization

The system uses a traffic-themed color palette:
- **Primary Green**: Safe operations and go signals
- **Amber**: Caution and alerts  
- **Red**: Emergency and stop signals
- **Light Green**: Card backgrounds and muted elements

Colors can be customized in `app/globals.css` using the CSS custom properties.

## Troubleshooting

### Connection Issues
- Ensure Flask backend is running on port 5000
- Check that CORS is properly configured in the backend
- Verify all required endpoints are available

### Authentication Problems
- Clear browser localStorage if experiencing login issues
- Ensure the backend users.csv file exists and is writable
- Check that session management is working in the backend

### Real-time Updates Not Working
- Verify the `/api/traffic_data` endpoint is responding
- Check browser console for JavaScript errors
- Ensure WebSocket connections aren't being blocked

## License

This project is created for educational and demonstration purposes.
\`\`\`

```json file="" isHidden
