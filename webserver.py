import network
import socket
import machine
import time
import gc # Garbage collection
import ujson # Import ujson for JSON parsing
import ntptime # For time synchronization
import utime
import urequests
import ubinascii

# --- Wi-Fi Configuration ---
WIFI_SSID = "Abita"          # <<<<<<<< CHANGE THIS
WIFI_PASSWORD = "October242014" # <<<<<<<< CHANGE THIS

# --- LED Configuration ---
WARM_LED_PIN = 18
NATURAL_LED_PIN = 26

# PWM Frequency and Duty Cycle Range
PWM_FREQ = 1000 # Hz
PWM_MAX_DUTY = 1023 # For ESP32's 10-bit PWM resolution

# --- Schedule Configuration ---
SCHEDULE_FILE = "schedules.json"  # File to store schedules
CHECK_SCHEDULE_INTERVAL = 10      # Check schedules every 10 seconds (more frequent checks)
TIME_SYNC_INTERVAL = 3600         # Sync time every hour (3600 seconds)

# --- Initialize LEDs ---
try:
    warm_led_pwm = machine.PWM(machine.Pin(WARM_LED_PIN), freq=PWM_FREQ)
    natural_led_pwm = machine.PWM(machine.Pin(NATURAL_LED_PIN), freq=PWM_FREQ)
    print(f"Initialized PWM for Warm LED (GPIO {WARM_LED_PIN}) and Natural LED (GPIO {NATURAL_LED_PIN}).")
    
    # Initialize LEDs to OFF (100% duty for common anode = off)
    warm_led_pwm.duty(PWM_MAX_DUTY)
    natural_led_pwm.duty(PWM_MAX_DUTY)
except ValueError as e:
    print(f"Error initializing PWM: {e}. Check if the pins are valid PWM pins.")
    warm_led_pwm = None
    natural_led_pwm = None

# --- Time Tracking Variables ---
last_schedule_check = 0
last_time_sync = 0
last_firebase_update = 0  # Add this new variable to track Firebase registration time
time_synced = False

# --- Schedules Store ---
current_schedules = [] # Global list to store schedules

# --- LED Control Functions ---

def set_led_brightness(led_pwm, level):
    """Sets the brightness of an LED using PWM for COMMON ANODE configuration."""
    if led_pwm is None:
        print("LED PWM not initialized.")
        return False
    try:
        # Ensure level is within 0-100 range
        level = max(0, min(100, int(level)))
        # For COMMON ANODE, 0% brightness is MAX_DUTY, 100% brightness is 0 duty.
        # Invert the level: 0% brightness -> 100% inverted level
        #                 100% brightness -> 0% inverted level
        inverted_level = 100 - level
        duty = int(inverted_level / 100 * PWM_MAX_DUTY)
        led_pwm.duty(duty)
        print(f"Set brightness to {level}% (Common Anode duty={duty}).")
        return True
    except (ValueError, TypeError):
        print(f"Invalid brightness level: {level}")
        return False

def turn_led_on(led_pwm):
    """Turns an LED fully on (100% brightness) for COMMON ANODE configuration."""
    if led_pwm is None:
        print("LED PWM not initialized.")
        return False
    # For COMMON ANODE, 100% brightness means 0V output, so duty cycle of 0.
    led_pwm.duty(0)
    print("Turned LED ON (100% - Common Anode).")
    return True

def turn_led_off(led_pwm):
    """Turns an LED fully off (0% brightness) for COMMON ANODE configuration."""
    if led_pwm is None:
        print("LED PWM not initialized.")
        return False
    # For COMMON ANODE, 0% brightness means 3.3V output, so duty cycle of PWM_MAX_DUTY.
    led_pwm.duty(PWM_MAX_DUTY)
    print("Turned LED OFF (0% - Common Anode).")
    return True

# --- Wi-Fi Connection Function ---

def connect_wifi(ssid, password):
    """Connects the ESP32 to the specified Wi-Fi network."""
    sta_if = network.WLAN(network.STA_IF)
    if not sta_if.isconnected():
        print(f'Connecting to Wi-Fi network: {ssid}...')
        sta_if.active(True)
        sta_if.connect(ssid, password)
        timeout = 20 # seconds - Increased timeout slightly
        start_time = time.time()
        while not sta_if.isconnected() and (time.time() - start_time) < timeout:
            time.sleep(1) # Increased sleep slightly
            print('.', end='')
        print()
    if sta_if.isconnected():
        print('Wi-Fi connected!')
        net_config = sta_if.ifconfig()
        print('Network config:', net_config)
        return net_config[0] # Return the IP address
    else:
        print('Wi-Fi connection failed!')
        return None

# --- Schedule Persistence Functions ---

def save_schedules_to_file():
    """Save the current schedules to a file in flash memory."""
    global current_schedules
    try:
        with open(SCHEDULE_FILE, 'w') as f:
            ujson.dump(current_schedules, f)
        print(f"Saved {len(current_schedules)} schedules to {SCHEDULE_FILE}")
        return True
    except OSError as e:
        print(f"Error saving schedules to file: {e}")
        return False

def load_schedules_from_file():
    """Load schedules from a file in flash memory."""
    global current_schedules
    try:
        with open(SCHEDULE_FILE, 'r') as f:
            current_schedules = ujson.load(f)
        print(f"Loaded {len(current_schedules)} schedules from {SCHEDULE_FILE}")
        return True
    except OSError as e:
        # File might not exist yet, which is fine
        if "ENOENT" in str(e):
            print(f"No schedule file found at {SCHEDULE_FILE}. Starting with empty schedules.")
        else:
            print(f"Error loading schedules from file: {e}")
        current_schedules = []
        return False

# --- Time Synchronization ---

def sync_time():
    """Synchronize the ESP32's RTC with an NTP server."""
    global time_synced
    
    # List of NTP servers to try in order
    ntp_servers = [
        'pool.ntp.org',
        'time.google.com',
        'time.cloudflare.com',
        'time.apple.com',
        'time.windows.com'
    ]
    
    # Try each server until one works
    for server in ntp_servers:
        try:
            print(f"Trying to sync time with NTP server: {server}")
            ntptime.host = server
            ntptime.settime()
            time_synced = True
            print(f"Time synchronized with NTP server {server}. Current time: {format_time()}")
            return True
        except OSError as e:
            print(f"Failed to sync time with {server}: {e}")
            # Continue to next server
    
    print("All NTP servers failed. Will retry later.")
    return False

def format_time():
    """Format the current time as a readable string."""
    t = time.localtime()
    return "{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
        t[0], t[1], t[2], t[3], t[4], t[5]
    )

def get_minutes_since_midnight():
    """Get the current time as minutes since midnight."""
    t = time.localtime()
    return t[3] * 60 + t[4]  # hours * 60 + minutes

# --- Schedule Execution ---

def parse_time_to_minutes(time_str):
    """Parse a time string like "14:30" or ISO format to minutes since midnight."""
    try:
        # Simple HH:MM format
        if ":" in time_str and len(time_str) <= 5:
            hours, minutes = time_str.split(":")
            return int(hours) * 60 + int(minutes)
        
        # If it's a full ISO datetime string like "2023-10-27T08:00:00Z"
        if "T" in time_str:
            # Extract the time part after T
            time_part = time_str.split("T")[1]
            # Remove Z, +00:00, etc.
            time_part = time_part.split("+")[0].split("Z")[0].split(".")[0]
            hours, minutes, _ = time_part.split(":")
            return int(hours) * 60 + int(minutes)
            
        # If it's another format we don't recognize, try using timestamp
        return 0
    except Exception as e:
        print(f"Error parsing time string '{time_str}': {e}")
        return 0

def check_and_apply_schedules():
    """Check current schedules against the current time and apply them."""
    global current_schedules
    
    if not time_synced:
        print("Time not synced yet. Cannot check schedules.")
        return
    
    print(f"Checking schedules at {format_time()}...")
    
    # Get current time in minutes since midnight
    current_minutes = get_minutes_since_midnight()
    print(f"Current time is {current_minutes // 60}:{current_minutes % 60:02d} ({current_minutes} minutes since midnight)")
    
    # Track which LED types should be active based on schedules
    warm_active = False
    warm_brightness = 0
    natural_active = False
    natural_brightness = 0
    
    # Check each schedule
    for schedule in current_schedules:
        try:
            # Convert schedule times to minutes
            start_time = schedule.get("startTime", "")
            end_time = schedule.get("endTime", "")
            
            # Skip schedules without proper time info
            if not start_time or not end_time:
                continue
                
            start_minutes = parse_time_to_minutes(start_time)
            end_minutes = parse_time_to_minutes(end_time)
            
            # Determine if the schedule is active now
            schedule_active = False
            
            # Handle schedules that cross midnight
            if end_minutes < start_minutes:
                # Schedule spans across midnight
                if current_minutes >= start_minutes or current_minutes < end_minutes:  # Changed <= to < for end time
                    schedule_active = True
            else:
                # Schedule within the same day
                if start_minutes <= current_minutes < end_minutes:  # Changed <= to < for end time
                    schedule_active = True
            
            if schedule_active:
                print(f"Schedule active: {schedule}")
                light_type = schedule.get("lightType", "both")
                brightness = int(schedule.get("brightness", 100))
                
                if light_type == "warm" or light_type == "both":
                    warm_active = True
                    warm_brightness = max(warm_brightness, brightness)
                
                if light_type == "natural" or light_type == "both":
                    natural_active = True
                    natural_brightness = max(natural_brightness, brightness)
        
        except Exception as e:
            print(f"Error processing schedule: {e}")
            continue
    
    # Apply the LED states based on active schedules
    if warm_active:
        print(f"Setting warm LED to {warm_brightness}%")
        set_led_brightness(warm_led_pwm, warm_brightness)
    else:
        print("Turning warm LED off")
        turn_led_off(warm_led_pwm)
    
    if natural_active:
        print(f"Setting natural LED to {natural_brightness}%")
        set_led_brightness(natural_led_pwm, natural_brightness)
    else:
        print("Turning natural LED off")
        turn_led_off(natural_led_pwm)

# --- HTTP Server Setup ---

def start_server(ip_address):
    """Starts the HTTP server on the specified IP address."""
    if ip_address is None:
        print("Cannot start server without an IP address.")
        return None

    addr = (ip_address, 80) # Bind to the ESP32's IP and port 80
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) # Allow socket reuse
        s.bind(addr)
        s.listen(5) # Listen for up to 5 connections
        print(f'HTTP server listening on http://{ip_address}:80')
        return s
    except OSError as e:
        print(f"Failed to start socket server: {e}")
        # Check if address is already in use
        if e.args[0] == 98: # errno 98 is Address already in use
            print("Address already in use. Server might already be running or needs a restart.")
        return None

# --- Request Handling ---

def handle_request(client_socket):
    """Handles an incoming HTTP request."""
    global current_schedules # Allow modification of the global variable
    try:
        request_bytes = client_socket.recv(2048) # Increased buffer size for potentially larger JSON payloads
        request_str = request_bytes.decode('utf-8')
        # print('Request string:', request_str) # Debug: print raw request string

        # Find the end of headers (double CRLF)
        header_end_index = request_str.find('\r\n\r\n')
        if header_end_index == -1:
            send_response(client_socket, "HTTP/1.1 400 Bad Request", "Bad Request - Invalid Headers", "text/plain")
            return

        header_part = request_str[:header_end_index]
        body_part = request_str[header_end_index + 4:] # Get the part after \r\n\r\n

        request_lines = header_part.split('\r\n')
        if not request_lines:
            send_response(client_socket, "HTTP/1.1 400 Bad Request", "Bad Request - No Request Line", "text/plain")
            return

        first_line = request_lines[0]
        parts = first_line.split()
        if len(parts) < 2:
            send_response(client_socket, "HTTP/1.1 400 Bad Request", "Bad Request - Malformed Request Line", "text/plain")
            return

        method = parts[0]
        path_with_query = parts[1]

        # Split path and query string
        path_parts = path_with_query.split('?')
        path = path_parts[0]
        query_string = path_parts[1] if len(path_parts) > 1 else ""

        response_status = "HTTP/1.1 200 OK"
        response_body = "OK"
        content_type = "text/plain"
        handled = False

        if method == 'GET':
            if path == "/warm/on":
                if turn_led_on(warm_led_pwm):
                    response_body = "Warm LED ON"
                    handled = True
            elif path == "/warm/off":
                if turn_led_off(warm_led_pwm):
                    response_body = "Warm LED OFF"
                    handled = True
            elif path == "/natural/on":
                if turn_led_on(natural_led_pwm):
                    response_body = "Natural LED ON"
                    handled = True
            elif path == "/natural/off":
                if turn_led_off(natural_led_pwm):
                    response_body = "Natural LED OFF"
                    handled = True
            elif path == "/warm/brightness":
                level_str = get_query_param(query_string, 'level')
                if level_str is not None:
                    if set_led_brightness(warm_led_pwm, level_str):
                        response_body = f"Warm LED brightness set to {level_str}%"
                        handled = True
                    else:
                        response_status = "HTTP/1.1 400 Bad Request"
                        response_body = "Invalid brightness value. Use ?level=0-100"
                        handled = True
                else:
                    response_status = "HTTP/1.1 400 Bad Request"
                    response_body = "Missing 'level' parameter. Use ?level=0-100"
                    handled = True
            elif path == "/natural/brightness":
                level_str = get_query_param(query_string, 'level')
                if level_str is not None:
                    if set_led_brightness(natural_led_pwm, level_str):
                        response_body = f"Natural LED brightness set to {level_str}%"
                        handled = True
                    else:
                        response_status = "HTTP/1.1 400 Bad Request"
                        response_body = "Invalid brightness value. Use ?level=0-100"
                        handled = True
                else:
                    response_status = "HTTP/1.1 400 Bad Request"
                    response_body = "Missing 'level' parameter. Use ?level=0-100"
                    handled = True
            elif path == "/schedules": # GET endpoint to retrieve current schedules (optional)
                response_body = ujson.dumps(current_schedules)
                content_type = "application/json"
                handled = True
            elif path == "/time": # GET endpoint to check current time (debugging)
                if time_synced:
                    response_body = format_time()
                else:
                    response_body = "Time not synchronized yet"
                handled = True
            elif path == "/sync": # GET endpoint to force time sync
                if sync_time():
                    response_body = f"Time synced: {format_time()}"
                else:
                    response_status = "HTTP/1.1 500 Internal Server Error"
                    response_body = "Failed to sync time"
                handled = True


        elif method == 'POST':
            if path == "/set_schedule":
                content_length = 0
                for line in request_lines[1:]: # Skip the first line (request line)
                    if line.lower().startswith('content-length:'):
                        try:
                            content_length = int(line.split(':')[1].strip())
                        except ValueError:
                            send_response(client_socket, "HTTP/1.1 400 Bad Request", "Invalid Content-Length", "text/plain")
                            return
                        break
                
                # print(f"Content-Length: {content_length}")
                # print(f"Body part length: {len(body_part)}")
                # print(f"Body part received: '{body_part}'")

                if content_length == 0:
                    send_response(client_socket, "HTTP/1.1 400 Bad Request", "Content-Length header missing or zero for POST", "text/plain")
                    return

                # Ensure the entire body is received if it wasn't in the first recv
                # This is a simplified body reading, assumes body_part contains the full JSON
                # For very large JSON, chunked reading would be more robust.
                json_payload_str = body_part[:content_length] # Use content_length to get the actual body

                # print(f"JSON payload string: '{json_payload_str}'")


                if not json_payload_str:
                    response_status = "HTTP/1.1 400 Bad Request"
                    response_body = "Empty JSON payload"
                    handled = True
                else:
                    try:
                        new_schedules = ujson.loads(json_payload_str)
                        if isinstance(new_schedules, list):
                            current_schedules = new_schedules # Replace existing schedules
                            save_schedules_to_file() # Save to flash for persistence
                            response_body = "Schedules updated successfully."
                            print(f"Received {len(current_schedules)} schedules.")
                            # Apply schedules immediately
                            check_and_apply_schedules()
                            handled = True
                        else:
                            response_status = "HTTP/1.1 400 Bad Request"
                            response_body = "Payload must be a JSON array of schedules."
                            handled = True
                    except ValueError as e:
                        response_status = "HTTP/1.1 400 Bad Request"
                        response_body = f"Invalid JSON format: {e}"
                        print(f"JSON parsing error: {e}, Payload: '{json_payload_str}'")
                        handled = True
            else: # Unknown POST path
                response_status = "HTTP/1.1 404 Not Found"
                response_body = "Endpoint not found for POST."
                handled = True


        if not handled:
            response_status = "HTTP/1.1 404 Not Found"
            response_body = f"Endpoint not found for method {method} and path {path}."
            print(f"Unknown path/method: {method} {path}")

        send_response(client_socket, response_status, response_body, content_type)

    except OSError as e:
        print(f"Error handling request: {e}")
    finally:
        client_socket.close() # Always close the socket
        gc.collect() # Help manage memory

# --- Helper function to get query parameters ---
def get_query_param(query_string, param_name):
    """Parses query string to find a specific parameter."""
    if not query_string:
        return None
    params = query_string.split('&')
    for param in params:
        key_value = param.split('=')
        if len(key_value) == 2:
            key, value = key_value
            if key == param_name:
                return value
    return None

# --- Helper function to send HTTP response ---
def send_response(client_socket, status, body, content_type="text/plain"):
    """Sends an HTTP response back to the client."""
    response = f'{status}\r\nContent-Type: {content_type}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n{body}'
    client_socket.sendall(response.encode('utf-8'))

def get_device_id():
    """Generate a unique device ID based on ESP32's MAC address"""
    mac = ubinascii.hexlify(network.WLAN(network.STA_IF).config('mac')).decode()
    return f"esp32-{mac}"

def register_with_firebase():
    """Register this device's IP with Firebase"""
    try:
        device_id = get_device_id()
        
        # Your Firebase URL - already set up!
        firebase_url = "https://apollo-671a4-default-rtdb.asia-southeast1.firebasedatabase.app"
        
        # Data to register
        data = {
            "ip_address": esp32_ip,
            "device_name": "Smart Lighting Controller",
            "last_online": time.time(),
            "device_type": "lighting"
        }
        
        # Send to Firebase - note the /devices/ path and .json suffix required by Firebase
        response = urequests.put(
            f"{firebase_url}/devices/{device_id}.json",
            json=data
        )
        
        if response.status_code == 200:
            print(f"Successfully registered with Firebase. Response: {response.text}")
            return True
        else:
            print(f"Failed to register. Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error registering device: {e}")
        return False

# --- Main execution ---
if __name__ == "__main__":
    esp32_ip = connect_wifi(WIFI_SSID, WIFI_PASSWORD)

    if esp32_ip:
        # Register device with Firebase
        register_with_firebase()
        last_firebase_update = time.time()  # Track the initial registration time
        
        # Try to load saved schedules
        load_schedules_from_file()
        
        # Try to sync time with NTP server
        sync_time()
        
        # Start the web server
        server_socket = start_server(esp32_ip)
        if server_socket:
            print("Server is running. Waiting for connections...")
            
            # Main loop
            while True:
                try:
                    # Check if it's time to handle scheduled tasks
                    current_time = time.time()
                    
                    # Check if we should sync time
                    if not time_synced or (current_time - last_time_sync) >= TIME_SYNC_INTERVAL:
                        sync_time()
                        last_time_sync = current_time
                    
                    # Check if we should process schedules
                    if time_synced and (current_time - last_schedule_check) >= CHECK_SCHEDULE_INTERVAL:
                        check_and_apply_schedules()
                        last_schedule_check = current_time
                    
                    # Check if it's time to update Firebase registration (every hour)
                    if (current_time - last_firebase_update) >= 3600:
                        if register_with_firebase():
                            last_firebase_update = current_time
                    
                    # Set socket timeout to allow periodic checks
                    server_socket.settimeout(1.0)
                    
                    try:
                        # Accept incoming connection (with timeout)
                        client_socket, client_address = server_socket.accept()
                        print(f"Connection from {client_address}")
                        # Handle the request
                        handle_request(client_socket)
                    except OSError as e:
                        # Check for timeout errors by error number or message
                        # Error 116 is ETIMEDOUT - this is expected from the timeout and should be ignored
                        if "[Errno 116]" not in str(e) and "timed out" not in str(e):
                            print(f"Error accepting connection: {e}")
                    
                except KeyboardInterrupt:
                    print("Server stopped manually.")
                    break # Exit loop on Ctrl+C
                
                except Exception as e:
                    print(f"Unexpected error in main loop: {e}")
                    time.sleep(5)  # Wait a bit before retrying
            
            # Clean up resources
            server_socket.close()
            print("Server socket closed.")
        else:
            print("Failed to start HTTP server.")
    else:
        print("Could not connect to Wi-Fi. Server will not start.")

    # Optional: Deinitialize PWM or turn off LEDs before restart/exit
    if warm_led_pwm:
        warm_led_pwm.deinit()
    if natural_led_pwm:
        natural_led_pwm.deinit()
    print("PWM deinitialized.")

