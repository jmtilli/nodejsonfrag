const jsonfrag = require('.');
const data =
	"{\n" +
	"        \"customers\": [\n" +
	"                {\n" +
	"                        \"id\": 1e+000,\n" +
	"                        \"name\": \"Clark Henson\",\n" +
	"                        \"accountCount\": 1,\n" +
	"                        \"totalBalance\": 5085.96\n" +
	"                },\n" +
	"                {\n" +
	"                        \"id\": 20.00e-1,\n" +
	"                        \"name\": \"Elnora Ericson\",\n" +
	"                        \"accountCount\": 3,\n" +
	"                        \"totalBalance\": 3910.11\n" +
	"                }\n" +
	"        ]\n" +
	"}\n";
function my_start_dict(ctx, key)
{
	//console.log("START:");
	//console.log(ctx.jsonfrag.keystack);
	if (jsonfrag.jsonfrag_is(ctx, ["customers", null]))
	{
		//console.log("Starting fragment collection");
		jsonfrag.jsonfrag_start_fragment_collection(ctx);
	}
}
function my_end_dict(ctx, key, n)
{
	//console.log("END:");
	//console.log(ctx.jsonfrag.keystack);
	if (jsonfrag.jsonfrag_is(ctx, ["customers", null]))
	{
		console.log("id " + n.id);
		console.log("account count " + n.accountCount);
		console.log("total balance " + n.totalBalance);
		console.log("name " + n.name);
	}
}
const fraghandler = {
	'start_dict': my_start_dict,
	'end_dict': my_end_dict,
};
//ctx = jsonfrag.jsonfrag_new(fraghandler);
//jsonfrag.jsonstream_feed(ctx, data, 0, data.length, true);
jsonfrag.jsonfrag_parse(data, fraghandler);
