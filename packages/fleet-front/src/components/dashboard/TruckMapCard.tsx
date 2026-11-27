import {
	Clock4Icon,
	FuelIcon,
	GaugeIcon,
	MapPinIcon,
	MoreHorizontalIcon,
	PhoneIcon,
} from "lucide-react";

export function TruckMapCard() {
	return (
		<div className="flex h-full flex-col justify-between gap-4 rounded-[20px] bg-white p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.08)]">
			{/* Status Header */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="inline-flex items-center gap-2 rounded-[15px] bg-[rgba(149,200,152,0.22)] px-3 py-1 text-[13px] font-medium text-[#034923]">
						<span className="size-2 rounded-full bg-[#1fb362]" />
						Driving
					</span>
					<span className="text-[12px] font-medium text-[#545454]/75">
						Updated 12 sec ago
					</span>
				</div>
				<button
					type="button"
					aria-label="Vehicle options"
					className="rounded-md p-1 text-[#545454] transition-colors hover:bg-neutral-100"
				>
					<MoreHorizontalIcon className="size-5" />
				</button>
			</div>

			{/* Hero Truck Image */}
			<div className="flex items-center justify-center py-1">
				<img
					src="/images/dashboard/truck-hero.png"
					alt="Active fleet box truck"
					className="h-[180px] w-full max-w-[320px] object-contain"
				/>
			</div>

			{/* Telemetry Mini Cards */}
			<div className="grid grid-cols-3 gap-3">
				<div className="flex flex-col gap-1.5 rounded-[12px] border border-black/10 bg-white p-3.5">
					<div className="flex size-8 items-center justify-center rounded-[6px] bg-[rgba(125,211,130,0.2)] text-[#1a7a3e]">
						<GaugeIcon className="size-4" />
					</div>
					<span className="text-[12px] font-medium text-black/50">Speed</span>
					<p className="text-[15px] font-semibold text-black">
						72 <span className="text-[12px] font-normal">km/h</span>
					</p>
				</div>

				<div className="flex flex-col gap-1.5 rounded-[12px] border border-black/10 bg-white p-3.5">
					<div className="flex size-8 items-center justify-center rounded-[6px] bg-[rgba(125,211,130,0.2)] text-[#1a7a3e]">
						<FuelIcon className="size-4" />
					</div>
					<span className="text-[12px] font-medium text-black/50">
						Fuel Level
					</span>
					<p className="text-[15px] font-semibold text-black">64%</p>
				</div>

				<div className="flex flex-col gap-1.5 rounded-[12px] border border-black/10 bg-white p-3.5">
					<div className="flex size-8 items-center justify-center rounded-[6px] bg-[rgba(125,211,130,0.2)] text-[#1a7a3e]">
						<Clock4Icon className="size-4" />
					</div>
					<span className="text-[12px] font-medium text-black/50">
						Drive Time
					</span>
					<p className="text-[15px] font-semibold text-black">4h 18m</p>
				</div>
			</div>

			{/* Assigned Driver */}
			<div className="flex items-center justify-between gap-3 rounded-[12px] bg-[rgba(31,179,98,0.1)] px-3.5 py-2.5 shadow-[0px_1px_4px_0px_rgba(0,0,0,0.06)]">
				<div className="flex items-center gap-3 min-w-0">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(144,191,163,0.46)] text-[14px] font-semibold text-[#2e4030]">
						AK
					</div>
					<div className="min-w-0">
						<p className="text-[11px] font-medium text-black/45">
							Assigned Driver
						</p>
						<p className="truncate text-[15px] font-semibold text-black">
							Ahmed Khalid
						</p>
					</div>
				</div>
				<button
					type="button"
					aria-label="Call assigned driver"
					className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-black/15 bg-[rgba(125,211,130,0.07)] text-[#2a6134] transition-colors hover:bg-[rgba(125,211,130,0.2)]"
				>
					<PhoneIcon className="size-4" />
				</button>
			</div>

			{/* Map Preview + Location Footer */}
			<div className="overflow-hidden rounded-[14px] border border-[#d6d4d4] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]">
				<div className="h-[185px] w-full overflow-hidden">
					<img
						src="/images/dashboard/uae-map.png"
						alt="Vehicle route map"
						className="h-full w-full object-cover"
					/>
				</div>
				<div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
					<div className="flex items-center gap-3 min-w-0">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(123,198,175,0.19)] text-[#2a6134]">
							<MapPinIcon className="size-5" />
						</div>
						<div className="min-w-0">
							<p className="text-[11px] text-[#545454]">Current Location</p>
							<p className="truncate text-[14px] font-semibold text-black">
								Abu Dhabi University, Zayed City
							</p>
							<p className="truncate text-[11px] text-[#545454]">
								Next Stop: Mussafah Warehouse · 18km
							</p>
						</div>
					</div>
					<span className="shrink-0 rounded-[6px] border border-[rgba(84,84,84,0.22)] px-3 py-1.5 text-[13px] font-medium text-[#2a6134] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.06)]">
						Track Live
					</span>
				</div>
			</div>
		</div>
	);
}
