const Tool = require('./base');

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

class WeatherTool extends Tool {
  constructor() {
    super(
      'get_weather',
      'Get current weather and forecast for any city. No API key needed.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city name to get weather for',
        },
      },
      required: ['city'],
    };
  }

  async execute({ city }) {
    const geo = await this._geocode(city);
    if (!geo) {
      return `Could not find a city matching "${city}".`;
    }

    const params = new URLSearchParams({
      latitude: geo.latitude,
      longitude: geo.longitude,
      current_weather: 'true',
      daily: 'temperature_2m_max,temperature_2m_min,weathercode',
      timezone: 'auto',
      forecast_days: 3,
    });

    const res = await fetch(`${WEATHER_URL}?${params}`);
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);

    const data = await res.json();
    const cw = data.current_weather;
    const daily = data.daily;

    const lines = [
      `Weather for ${geo.name}${geo.admin1 ? ', ' + geo.admin1 : ''}${geo.country ? ', ' + geo.country : ''}:`,
      `Now: ${cw.temperature}°C, ${this._weatherDesc(cw.weathercode)}`,
      '',
      'Forecast:',
    ];

    for (let i = 0; i < daily.time.length; i++) {
      const date = new Date(daily.time[i]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      lines.push(`  ${date}: ${daily.temperature_2m_min[i]}–${daily.temperature_2m_max[i]}°C, ${this._weatherDesc(daily.weathercode[i])}`);
    }

    return lines.join('\n');
  }

  async _geocode(city) {
    const params = new URLSearchParams({
      name: city,
      count: '1',
      language: 'en',
      format: 'json',
    });

    const res = await fetch(`${GEO_URL}?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    return data.results[0];
  }

  _weatherDesc(code) {
    const map = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snowfall',
      73: 'Moderate snowfall',
      75: 'Heavy snowfall',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    return map[code] || 'Unknown';
  }
}

module.exports = WeatherTool;
