shader_type spatial;

uniform vec4 ground_color : source_color = vec4(0.3, 0.4, 0.2, 1.0);
uniform float wind_strength : hint_range(0.0, 0.2) = 0.035;
varying vec3 world_position;

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise21(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
		mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float broad = noise21(world_position.xz * 0.65);
	float grit = noise21(world_position.xz * 5.0);
	float gust = sin(world_position.x * 0.7 + world_position.z * 0.45 - TIME * 1.1);
	float shade = 0.86 + 0.20 * broad + 0.07 * grit + wind_strength * gust;
	ALBEDO = ground_color.rgb * shade;
	ROUGHNESS = 0.94;
}
