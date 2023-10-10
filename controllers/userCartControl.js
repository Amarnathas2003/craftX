

const { decodeJwt } = require('../helpers/jwtDecode');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { getCartCount } = require('../helpers/cart-product-count');
const Product = require('../models/productModel');
const {cartCountCheck} = require('../helpers/checkUserCartCount');



module.exports.usercart_post = async (req, res) => {


    const token = req.cookies.jwt;
    const productID = req.params.productID;
    const userID = decodeJwt(token);

    try {
        const getUser = await User.findById(userID);

        //check if item alredy exists in cart
        if (getUser) {
            for (const item of getUser.cart) {
                if (JSON.stringify(item.product_id) === JSON.stringify(productID)) {

                    try {
                        await User.findOneAndUpdate(
                            { _id: userID, "cart.product_id": productID },
                            { $inc: { "cart.$.count": 1 } }
                        );
                    } catch (error) {
                        console.log("Count update failed");
                        return res.status(401).json({ error: "Count Update Failed" });
                    }
                    return res.redirect('/my-cart');
                }
            }
        }

        if (getUser) {
            const productToAdd = {
                product_id: productID,
                count: 1,
            }

            getUser.cart.push(productToAdd);
            const addProduct = await getUser.save()

            if (addProduct) {
                return res.json({ status: true });
            }

        } else {
            return res.status(404).json({ error: 'User not found' });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


module.exports.mycart_get = async (req, res) => {

    const token = req.cookies.jwt;
    let user = decodeJwt(token);

    const cartCount = await getCartCount(user);

    try {
        let cartList = await User.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(user) } },
            { $project: { cart: 1, _id: 0 } },
            { $unwind: { path: '$cart' } },
            {
                $lookup: {
                    from: 'products',
                    localField: 'cart.product_id',
                    foreignField: '_id',
                    as: 'prod_detail'
                }
            },
            { $unwind: { path: '$prod_detail' } },
        ]);


        for (const prod of cartList) {
            prod.price = prod.prod_detail.price * prod.cart.cartCount;
        }

        //Calculate the Total product Amount
        let totalAmount = 0;
        for (const item of cartList) {
            totalAmount += item.prod_detail.price * item.cart.count;
        }

        if (cartList.length > 0) {
            console.log("This is the cart List",cartList);
            res.render('user/my-cart', { cartList, cartCount, totalAmount, message: 'Cart fetched successfully' });
        } else {
            res.render('user/my-cart', { message: 'Cart is empty or fetch failed' });
        }
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



module.exports.remove_product_get = async (req, res) => {
    const token = req.cookies.jwt;
    const userID = decodeJwt(token);
    // console.log(userID);
    const productID = req.params.productID;
    // console.log(productID)

    try {

        const updateUser = await User.findByIdAndUpdate(
            {
                _id: userID
            },
            {
                $pull: {
                    cart: {
                        product_id: productID
                    }
                }
            }
        );

        if (updateUser) {
            return res.json({ status: true });
        } else {
            return res.status(401).json({ error: "Data Remove Failed" });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


module.exports.usercartInc_get = async (req, res) => {

    const token = req.cookies.jwt;
    const userID = await decodeJwt(token)
    const productID = req.params.productID;

    //Get the current cart Count and return if count > 5
    const cartCount = await cartCountCheck(userID, productID);
    if(cartCount) {
        if(cartCount > 4) {
            res.json({message: "Reached Limit"});
            return;
        }
    }

    try {
        const checkStock = await Product.findById(productID);
        if (checkStock.stock > 0) {
            await User.findOneAndUpdate(
                { _id: userID, "cart.product_id": productID },
                { $inc: { "cart.$.count": 1 } }
            );
            res.json({ status: true });
        } else {
            res.json({status: false});
        }
    } catch (error) {
        console.log("Count update failed");
        return res.status(401).json({ error: "Count Update Failed" });
    }
}


module.exports.usercartDec_get = async (req, res) => {
    // console.log("User cart dec called");

    const token = req.cookies.jwt;
    const userID = await decodeJwt(token)
    const productID = req.params.productID;

    try {
        const getUser = await User.findOne({ _id: userID });
        console.log(getUser);
        const getItem = getUser.cart.find((item) => item.product_id == productID);
        console.log(getItem);

        if (getItem.count > 1) {
            await User.findOneAndUpdate(
                { _id: userID, "cart.product_id": productID },
                { $inc: { "cart.$.count": -1 } }
            );

            res.json({ status: true });
        } else {
            console.log("Cant Decrement")
            return;
        }
    } catch (error) {
        console.log("Count update failed");
        return res.status(401).json({ error: "Count Update Failed" });
    }
}