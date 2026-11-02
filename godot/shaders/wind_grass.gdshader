shader_type spatial;
render_mode cull_disabled;

uniform vec4 grass_color : source_color = vec4(0.25, 0.43, 0.15, 1.0);
uniform float wind_strength : hint_range(0.0, 0.5) = 0.18;

void vertex() {
	vec3 p = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float tip = 1.0 - UV.y;
	float gust = sin(TIME * 1.5 + p.x * 0.8 + p.z * 0.55 + float(INSTANCE_ID) * 0.17);
	VERTEX.x += gust * wind_strength * tip;
	VERTEX.z += gust * wind_strength * tip * 0.35;
}

void fragment() {
	float tip = 1.0 - UV.y;
	ALBEDO = grass_color.rgb * mix(0.65, 1.15, tip);
	ROUGHNESS = 1.0;
}
