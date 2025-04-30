#[macro_export]
macro_rules! query {
    ($u:ident.$($i:ident$(.)?)*, $k:ident) => {
        {
            let mut z = &$u;
            $(
                {
                    // println!("{}", stringify!($i));
                    // println!("{z:?}");
                    z = z.as_object().unwrap().get(stringify!($i)).unwrap();
                }
            )*

            z.$k().unwrap()
        }
    };
}

#[macro_export]
macro_rules! message {
    ($($t:tt)*) => {
        ::websocket::Message::text(::serde_json::json!($($t)*).to_string())
    };
}