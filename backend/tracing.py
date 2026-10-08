from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from agents import add_trace_processor
from openai_agents_opentelemetry import OpenTelemetryTracingProcessor

# Register the OpenTelemetry processor
add_trace_processor(OpenTelemetryTracingProcessor())

provider = TracerProvider()

provider.add_span_processor(
    BatchSpanProcessor(
        OTLPSpanExporter()
    )
)

trace.set_tracer_provider(provider)