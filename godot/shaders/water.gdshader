shader_type spatial;

uniform vec4 water_color : source_color = vec4(0.06, 0.35, 0.58, 1.0);
varying vec3 world_position;

void vertex() {
	vec3 p = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// La misma función en coordenadas de mundo mantiene unidas las losetas.
	VERTEX.y += sin(p.x * 1.3 + p.z * 0.8 + TIME * 1.6) * 0.045;
	VERTEX.y += sin(p.z * 1.8 - p.x * 0.5 - TIME * 1.15) * 0.025;
	world_position = p;
}

void fragment() {
	float ripple = sin(world_position.x * 2.0 + world_position.z * 1.3 + TIME * 1.5);
	float glint = pow(max(ripple, 0.0), 6.0) * 0.13;
	ALBEDO = water_color.rgb * (0.9 + 0.08 * ripple) + vec3(glint);
	METALLIC = 0.15;
	ROUGHNESS = 0.22;
}
