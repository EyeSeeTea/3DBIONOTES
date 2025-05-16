const proxy = require("http-proxy-middleware");
const apicache = require("apicache");
const _ = require("lodash");

const routes = {
    bws: process.env.REACT_APP_BWS || "https://3dbionotes.cnb.csic.es",
    bio: process.env.REACT_APP_3DBIO || "https://3dbionotes.cnb.csic.es",
};

module.exports = function (app) {
    proxyRoutes(app, {
        routes: ["/3dbionotes/bws"],
        target: routes.bws,
        rewritePath: true,
        cache: false,
    });

    proxyRoutes(app, {
        routes: ["/3dbionotes"],
        target: routes.bio,
        rewritePath: true,
        cache: false,
    });

    proxyRoutes(app, {
        routes: ["/ebi"],
        target: "https://www.ebi.ac.uk",
        rewritePath: true,
    });

    proxyRoutes(app, {
        routes: ["/uniprot"],
        target: "https://rest.uniprot.org",
        rewritePath: true,
    });

    proxyRoutes(app, {
        routes: ["/cci"],
        target: "https://cci.lbl.gov/static/data/",
        rewritePath: true,
        cache: false,
    });
};

function proxyRoutes(app, options) {
    const { routes, target, rewritePath, cache = true } = options;
    const pathRewrite = rewritePath
        ? _.fromPairs(routes.map(route => [`^${route}/`, "/"]))
        : undefined;

    const proxyOptions = {
        target,
        changeOrigin: true,
        pathRewrite,
        logLevel: "debug",
        secure: false,
        onProxyRes: function (proxyRes, req, res) {
            proxyRes.headers["Access-Control-Allow-Origin"] = "*";
            proxyRes.headers["Access-Control-Allow-Methods"] =
                "GET, POST, PUT, DELETE, PATCH, OPTIONS";
            proxyRes.headers["Access-Control-Allow-Headers"] =
                "Origin, X-Requested-With, Content-Type, Accept, Authorization";
        },
        onProxyReq: function (proxyReq, req, res) {
            if (!proxyReq.getHeader("Origin")) {
                proxyReq.setHeader("Origin", req.headers.origin || "http://localhost:3001");
            }
        },
    };

    const apiProxy = proxy.createProxyMiddleware(proxyOptions);

    if (cache) {
        const cacheMidddleware = apicache
            .options({
                debug: true,
                statusCodes: {
                    include: [200, 404],
                },
            })
            .middleware("1 day");
        app.use(routes, cacheMidddleware, apiProxy);
    } else {
        app.use(routes, apiProxy);
    }
}
