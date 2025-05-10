document.addEventListener('DOMContentLoaded', () => {
    const timeInput = document.getElementById('time-input');
    const convertBtn = document.getElementById('convert-btn');
    const resultDisplay = document.getElementById('result-display');
    const localTimezone = document.getElementById('local-timezone');
    
    // Display user's local timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    localTimezone.textContent = `${userTimezone} (GMT${getTimezoneOffset()})`;
    
    // Add event listeners
    convertBtn.addEventListener('click', convertTime);
    timeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            convertTime();
        }
    });
    
    // Initialize with focus
    setTimeout(() => {
        timeInput.focus();
    }, 500);
    
    // Function to convert the time
    function convertTime() {
        const input = timeInput.value.trim();
        
        if (!input) {
            showError("Please enter a time");
            return;
        }
        
        try {
            const result = parseAndConvertTime(input);
            showSuccess(result);
        } catch (error) {
            showError(error.message || "Couldn't parse that time format");
        }
    }
    
    // Function to parse and convert the time from input to local timezone
    function parseAndConvertTime(input) {
        // RegEx patterns for different time formats with flexible spacing
        const patterns = [
            // 7pm EST, 3AM JST, etc. - with flexible spacing
            {
                regex: /(\d{1,2})\s*(am|pm|AM|PM)\s+([A-Za-z][A-Za-z\s]*)/,
                handler: (matches) => {
                    const hour = parseInt(matches[1]);
                    const meridiem = matches[2].toLowerCase();
                    const timezone = matches[3].trim();
                    
                    // Convert 12-hour to 24-hour format
                    let hour24 = hour;
                    if (meridiem === 'pm' && hour < 12) {
                        hour24 += 12;
                    } else if (meridiem === 'am' && hour === 12) {
                        hour24 = 0;
                    }
                    
                    return createDateFromParts(hour24, 0, timezone);
                }
            },
            // 15:30 EST, 7:45 JST, etc. - with flexible spacing
            {
                regex: /(\d{1,2})\s*:\s*(\d{2})\s+([A-Za-z][A-Za-z\s]*)/,
                handler: (matches) => {
                    const hour = parseInt(matches[1]);
                    const minute = parseInt(matches[2]);
                    const timezone = matches[3].trim();
                    
                    return createDateFromParts(hour, minute, timezone);
                }
            },
            // 3:30pm EST, 11:45am JST, etc. - with flexible spacing
            {
                regex: /(\d{1,2})\s*:\s*(\d{2})\s*(am|pm|AM|PM)\s+([A-Za-z][A-Za-z\s]*)/,
                handler: (matches) => {
                    const hour = parseInt(matches[1]);
                    const minute = parseInt(matches[2]);
                    const meridiem = matches[3].toLowerCase();
                    const timezone = matches[4].trim();
                    
                    // Convert 12-hour to 24-hour format
                    let hour24 = hour;
                    if (meridiem === 'pm' && hour < 12) {
                        hour24 += 12;
                    } else if (meridiem === 'am' && hour === 12) {
                        hour24 = 0;
                    }
                    
                    return createDateFromParts(hour24, minute, timezone);
                }
            }
        ];
        
        // Try to match the input against the patterns
        for (const pattern of patterns) {
            const matches = input.match(pattern.regex);
            if (matches) {
                return pattern.handler(matches);
            }
        }
        
        throw new Error("Unrecognized time format. Try something like '7pm EST' or '15:30 JST'");
    }
    
    // Function to create a date from parts and convert it
    function createDateFromParts(hour, minute, timezoneInput) {
        // Try to match full timezone name first
        const timezoneFromFullName = getTimezoneByFullName(timezoneInput);
        
        if (timezoneFromFullName) {
            // Found by full name
            const dateString = `${new Date().getFullYear()}-${padZero(new Date().getMonth() + 1)}-${padZero(new Date().getDate())}T${padZero(hour)}:${padZero(minute)}:00${timezoneFromFullName.offset}`;
            return formatDateToLocalTime(new Date(dateString));
        }
        
        // If not found by full name, try abbreviation
        const timezoneCode = timezoneInput.toUpperCase().replace(/\s+/g, '');
        
        // Expand short timezone codes
        const expandedCode = expandShortTimezoneCode(timezoneCode);
        
        // Try to get timezone info
        const timezone = getTimezoneByCode(expandedCode);
        
        if (!timezone) {
            // Find suggestions if timezone not found
            const suggestions = findTimezoneSuggestions(timezoneCode);
            if (suggestions.length > 0) {
                throw new Error(`Unknown timezone: ${timezoneInput}. Did you mean: ${suggestions.join(', ')}?`);
            } else {
                throw new Error(`Unknown timezone: ${timezoneInput}`);
            }
        }
        
        // Get current date (we'll just change the time part)
        const now = new Date();
        
        // Create a date string in ISO format with the timezone offset
        const dateString = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}T${padZero(hour)}:${padZero(minute)}:00${timezone.offset}`;
        
        // Parse the date string to get the time in the input timezone
        const date = new Date(dateString);
        
        // Format the date in the user's local timezone
        return formatDateToLocalTime(date);
    }
    
    // Function to expand short timezone codes
    function expandShortTimezoneCode(code) {
        const shortCodes = {
            'PT': 'PST',  // Pacific Time
            'MT': 'MST',  // Mountain Time
            'CT': 'CST',  // Central Time
            'ET': 'EST',  // Eastern Time
            'AT': 'AST',  // Atlantic Time
            'NT': 'NST',  // Newfoundland Time
            'AKT': 'AKST', // Alaska Time
            'HT': 'HST',  // Hawaii Time
            'Z': 'UTC',   // Zulu Time (UTC)
        };
        
        return shortCodes[code] || code;
    }
    
    // Function to find similar timezone suggestions
    function findTimezoneSuggestions(code) {
        const allTimezones = Object.keys(getTimezoneMap());
        const shortCodesMap = {
            'PT': ['PST', 'PDT'],
            'MT': ['MST', 'MDT'],
            'CT': ['CST', 'CDT'],
            'ET': ['EST', 'EDT'],
        };
        
        // Full name matching phrases
        const fullNamePhrases = [
            'STANDARD', 'DAYLIGHT', 'TIME', 'EASTERN', 'CENTRAL', 'MOUNTAIN', 'PACIFIC'
        ];
        
        // Check if it might be a full name (contains common words)
        for (const phrase of fullNamePhrases) {
            if (code.includes(phrase)) {
                return ['EST', 'CST', 'MST', 'PST']; // Suggest common timezones for full name inputs
            }
        }
        
        // Check if it's a common short code first
        if (shortCodesMap[code]) {
            return shortCodesMap[code];
        }
        
        // Otherwise use string similarity
        const suggestions = [];
        const minLength = code.length > 1 ? code.length - 1 : 1;
        
        for (const tz of allTimezones) {
            // Check if the timezone starts with the same letter
            if (tz[0] === code[0]) {
                // Simple check - if the code is a prefix or very similar
                if (tz.startsWith(code) || (tz.length >= minLength && levenshteinDistance(code, tz) <= 2)) {
                    suggestions.push(tz);
                    if (suggestions.length >= 3) break; // Limit to 3 suggestions
                }
            }
        }
        
        return suggestions;
    }
    
    // Simple Levenshtein distance implementation for string similarity
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        
        // Initialize matrix
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        // Fill matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        
        return matrix[b.length][a.length];
    }
    
    // Function to format the date to local time - now in short form
    function formatDateToLocalTime(date) {
        const formattedTime = date.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        return `${formattedTime}<br><span style="font-size: 0.9rem; opacity: 0.8;">in ${userTimezone}</span>`;
    }
    
    // Function to pad numbers with leading zeros
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }
    
    // Get timezone offset string in the format +/-HH:MM
    function getTimezoneOffset() {
        const date = new Date();
        const offset = date.getTimezoneOffset();
        const hours = Math.abs(Math.floor(offset / 60));
        const minutes = Math.abs(offset % 60);
        const sign = offset < 0 ? '+' : '-';
        
        return `${sign}${padZero(hours)}:${padZero(minutes)}`;
    }
    
    // Common timezone mappings (add more as needed)
    function getTimezoneByCode(code) {
        return getTimezoneMap()[code];
    }
    
    // Function to get all timezone mappings
    function getTimezoneMap() {
        return {
            // North America
            'EST': { offset: '-05:00', name: 'Eastern Standard Time' },
            'EDT': { offset: '-04:00', name: 'Eastern Daylight Time' },
            'CST': { offset: '-06:00', name: 'Central Standard Time' },
            'CDT': { offset: '-05:00', name: 'Central Daylight Time' },
            'MST': { offset: '-07:00', name: 'Mountain Standard Time' },
            'MDT': { offset: '-06:00', name: 'Mountain Daylight Time' },
            'PST': { offset: '-08:00', name: 'Pacific Standard Time' },
            'PDT': { offset: '-07:00', name: 'Pacific Daylight Time' },
            'AKST': { offset: '-09:00', name: 'Alaska Standard Time' },
            'AKDT': { offset: '-08:00', name: 'Alaska Daylight Time' },
            'HST': { offset: '-10:00', name: 'Hawaii Standard Time' },
            'AST': { offset: '-04:00', name: 'Atlantic Standard Time' },
            'NST': { offset: '-03:30', name: 'Newfoundland Standard Time' },
            
            // Europe
            'GMT': { offset: '+00:00', name: 'Greenwich Mean Time' },
            'BST': { offset: '+01:00', name: 'British Summer Time' },
            'WET': { offset: '+00:00', name: 'Western European Time' },
            'WEST': { offset: '+01:00', name: 'Western European Summer Time' },
            'CET': { offset: '+01:00', name: 'Central European Time' },
            'CEST': { offset: '+02:00', name: 'Central European Summer Time' },
            'EET': { offset: '+02:00', name: 'Eastern European Time' },
            'EEST': { offset: '+03:00', name: 'Eastern European Summer Time' },
            
            // Asia
            'IST': { offset: '+05:30', name: 'India Standard Time' },
            'JST': { offset: '+09:00', name: 'Japan Standard Time' },
            'CNT': { offset: '+08:00', name: 'China Standard Time' },
            'KST': { offset: '+09:00', name: 'Korea Standard Time' },
            'PHT': { offset: '+08:00', name: 'Philippine Time' },
            'SGT': { offset: '+08:00', name: 'Singapore Time' },
            
            // Australia
            'AEST': { offset: '+10:00', name: 'Australian Eastern Standard Time' },
            'AEDT': { offset: '+11:00', name: 'Australian Eastern Daylight Time' },
            'ACST': { offset: '+09:30', name: 'Australian Central Standard Time' },
            'ACDT': { offset: '+10:30', name: 'Australian Central Daylight Time' },
            'AWST': { offset: '+08:00', name: 'Australian Western Standard Time' },
            
            // Common UTC/GMT
            'UTC': { offset: '+00:00', name: 'Coordinated Universal Time' },
            'Z': { offset: '+00:00', name: 'Zulu Time (UTC)' },
        };
    }
    
    // Function to get timezone by full name
    function getTimezoneByFullName(fullName) {
        // Normalize input by removing extra spaces and converting to lowercase
        const normalizedInput = fullName.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Create a map of full names to timezone codes
        const timezoneMap = getTimezoneMap();
        const fullNameMap = {
            // North America
            'eastern standard time': timezoneMap['EST'],
            'eastern daylight time': timezoneMap['EDT'],
            'eastern time': timezoneMap['EST'],
            'central standard time': timezoneMap['CST'],
            'central daylight time': timezoneMap['CDT'],
            'central time': timezoneMap['CST'],
            'mountain standard time': timezoneMap['MST'],
            'mountain daylight time': timezoneMap['MDT'],
            'mountain time': timezoneMap['MST'],
            'pacific standard time': timezoneMap['PST'],
            'pacific daylight time': timezoneMap['PDT'],
            'pacific time': timezoneMap['PST'],
            'alaska standard time': timezoneMap['AKST'],
            'alaska daylight time': timezoneMap['AKDT'],
            'alaska time': timezoneMap['AKST'],
            'hawaii standard time': timezoneMap['HST'],
            'hawaii time': timezoneMap['HST'],
            'atlantic standard time': timezoneMap['AST'],
            'atlantic time': timezoneMap['AST'],
            'newfoundland standard time': timezoneMap['NST'],
            'newfoundland time': timezoneMap['NST'],
            
            // Europe
            'greenwich mean time': timezoneMap['GMT'],
            'british summer time': timezoneMap['BST'],
            'western european time': timezoneMap['WET'],
            'western european summer time': timezoneMap['WEST'],
            'central european time': timezoneMap['CET'],
            'central european summer time': timezoneMap['CEST'],
            'eastern european time': timezoneMap['EET'],
            'eastern european summer time': timezoneMap['EEST'],
            
            // Asia
            'india standard time': timezoneMap['IST'],
            'japan standard time': timezoneMap['JST'],
            'china standard time': timezoneMap['CNT'],
            'korea standard time': timezoneMap['KST'],
            'philippine time': timezoneMap['PHT'],
            'singapore time': timezoneMap['SGT'],
            
            // Australia
            'australian eastern standard time': timezoneMap['AEST'],
            'australian eastern daylight time': timezoneMap['AEDT'],
            'australian central standard time': timezoneMap['ACST'],
            'australian central daylight time': timezoneMap['ACDT'],
            'australian western standard time': timezoneMap['AWST'],
            
            // Common UTC/GMT
            'coordinated universal time': timezoneMap['UTC'],
            'universal time': timezoneMap['UTC'],
            'zulu time': timezoneMap['Z'],
            'standard time': timezoneMap['GMT'], // Default case for just "Standard Time"
        };
        
        return fullNameMap[normalizedInput];
    }
    
    // Function to show success message with animation
    function showSuccess(message) {
        resultDisplay.innerHTML = message;
        resultDisplay.parentElement.classList.remove('error-animation');
        resultDisplay.parentElement.classList.add('success-animation');
        
        setTimeout(() => {
            resultDisplay.parentElement.classList.remove('success-animation');
        }, 500);
    }
    
    // Function to show error message with animation
    function showError(message) {
        resultDisplay.textContent = message;
        resultDisplay.parentElement.classList.remove('success-animation');
        resultDisplay.parentElement.classList.add('error-animation');
        
        setTimeout(() => {
            resultDisplay.parentElement.classList.remove('error-animation');
        }, 500);
    }
}); 