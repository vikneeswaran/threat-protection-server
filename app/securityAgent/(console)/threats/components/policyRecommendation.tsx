export default function PolicyRecommendation(){

return (

<div
className="
bg-[#111827]
border border-slate-800
rounded-xl
p-5
"
>


<h2 className="font-semibold">
Policy Recommendation
</h2>


<p className="
text-slate-400
mt-4
text-sm
">

3 endpoints are repeatedly triggering credential dumping behavior.
Apply stricter memory-access policy and enforce isolation on repeated detections.

</p>


<button
className="
w-full
mt-5
bg-slate-700
py-3
rounded-lg
"
>
Apply Suggested Policy
</button>


</div>

)

}